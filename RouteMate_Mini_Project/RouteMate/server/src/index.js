import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import auth from './middleware/auth.js';
dotenv.config();
const app = express();
app.use(cors({origin:true}));
app.use(express.json());

const tokenFor = user => jwt.sign({id:user.id,email:user.email,name:user.full_name}, process.env.JWT_SECRET, {expiresIn:'7d'});
const cleanUser = u => ({id:u.id,full_name:u.full_name,email:u.email,phone:u.phone,bio:u.bio});

app.get('/api/health', (_,res)=>res.json({ok:true,service:'RouteMate API'}));

app.post('/api/auth/register', async (req,res)=>{
  try {
    const {full_name,email,password,phone=''} = req.body;
    if(!full_name || !email || !password || password.length<6) return res.status(400).json({message:'Name, email and password (6+ characters) are required.'});
    const [exists] = await pool.query('SELECT id FROM users WHERE email=?',[email.toLowerCase()]);
    if(exists.length) return res.status(409).json({message:'An account with this email already exists.'});
    const hash=await bcrypt.hash(password,10);
    const [r]=await pool.query('INSERT INTO users(full_name,email,phone,password_hash) VALUES(?,?,?,?)',[full_name,email.toLowerCase(),phone,hash]);
    const user={id:r.insertId,full_name,email:email.toLowerCase(),phone,bio:''};
    res.status(201).json({token:tokenFor(user),user:cleanUser(user)});
  } catch(e){res.status(500).json({message:'Registration failed. Check the server/database setup.'});}
});
app.post('/api/auth/login', async(req,res)=>{
  try {
    const {email,password}=req.body;
    const [rows]=await pool.query('SELECT * FROM users WHERE email=?',[String(email||'').toLowerCase()]);
    if(!rows.length || !(await bcrypt.compare(password||'',rows[0].password_hash))) return res.status(401).json({message:'Invalid email or password.'});
    res.json({token:tokenFor(rows[0]),user:cleanUser(rows[0])});
  }catch(e){res.status(500).json({message:'Login failed.'});}
});
app.get('/api/profile',auth,async(req,res)=>{
  const [rows]=await pool.query('SELECT id,full_name,email,phone,bio FROM users WHERE id=?',[req.user.id]);
  res.json(rows[0]);
});
app.put('/api/profile',auth,async(req,res)=>{
  const {full_name,phone,bio}=req.body;
  await pool.query('UPDATE users SET full_name=?,phone=?,bio=? WHERE id=?',[full_name,phone||'',bio||'',req.user.id]);
  const [rows]=await pool.query('SELECT id,full_name,email,phone,bio FROM users WHERE id=?',[req.user.id]);
  res.json(rows[0]);
});

app.post('/api/trips',auth,async(req,res)=>{
  const {start_location,destination,travel_date,departure_time,transport,seats_available=1,notes=''}=req.body;
  if(!start_location||!destination||!travel_date||!departure_time||!transport) return res.status(400).json({message:'Please complete all required trip fields.'});
  const [r]=await pool.query('INSERT INTO trips(user_id,start_location,destination,travel_date,departure_time,transport,seats_available,notes) VALUES(?,?,?,?,?,?,?,?)',
  [req.user.id,start_location,destination,travel_date,departure_time,transport,seats_available,notes]);
  res.status(201).json({id:r.insertId,message:'Your trip has been published.'});
});
app.get('/api/trips/mine',auth,async(req,res)=>{
  const [rows]=await pool.query('SELECT * FROM trips WHERE user_id=? ORDER BY travel_date DESC,departure_time',[req.user.id]); res.json(rows);
});
app.put('/api/trips/:id',auth,async(req,res)=>{
  const {start_location,destination,travel_date,departure_time,transport,seats_available,notes,status}=req.body;
  const [r]=await pool.query('UPDATE trips SET start_location=?,destination=?,travel_date=?,departure_time=?,transport=?,seats_available=?,notes=?,status=? WHERE id=? AND user_id=?',
  [start_location,destination,travel_date,departure_time,transport,seats_available,notes,status||'open',req.params.id,req.user.id]);
  if(!r.affectedRows) return res.status(404).json({message:'Trip not found.'}); res.json({message:'Trip updated.'});
});
app.delete('/api/trips/:id',auth,async(req,res)=>{
  const [r]=await pool.query('DELETE FROM trips WHERE id=? AND user_id=?',[req.params.id,req.user.id]);
  if(!r.affectedRows) return res.status(404).json({message:'Trip not found.'}); res.json({message:'Trip deleted.'});
});

function scoreTrip(a,b){
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
  const startA=norm(a.start_location), startB=norm(b.start_location), endA=norm(a.destination), endB=norm(b.destination);
  let score=55;
  if(startA===startB) score+=25; else if(startA.includes(startB)||startB.includes(startA)) score+=15;
  if(endA===endB) score+=20; else if(endA.includes(endB)||endB.includes(endA)) score+=12;
  if(a.transport===b.transport) score+=5;
  return Math.min(99,score);
}
app.get('/api/trips/search',auth,async(req,res)=>{
  const {start,destination,date,time,transport}=req.query;
  if(!start||!destination||!date) return res.status(400).json({message:'Start, destination and date are required.'});
  const [rows]=await pool.query(`SELECT t.*,u.full_name,u.bio FROM trips t JOIN users u ON t.user_id=u.id
    WHERE t.user_id<>? AND t.travel_date=? AND t.status='open' AND t.seats_available>0
    AND (LOWER(t.destination) LIKE LOWER(?) OR LOWER(?) LIKE CONCAT('%',LOWER(t.destination),'%'))
    ORDER BY t.departure_time`,[req.user.id,date,`%${destination}%`,destination]);
  const results=rows.map(t=>({...t,match_score:scoreTrip({start_location:start,destination,transport},t)}))
    .filter(t=>!transport||transport==='Any'||t.transport===transport)
    .sort((a,b)=>b.match_score-a.match_score);
  res.json(results);
});
app.get('/api/trips/available',auth,async(req,res)=>{
  const [rows]=await pool.query(`SELECT t.*,u.full_name FROM trips t JOIN users u ON u.id=t.user_id WHERE t.user_id<>? AND t.status='open' ORDER BY t.travel_date,t.departure_time LIMIT 100`,[req.user.id]);res.json(rows);
});

app.post('/api/requests',auth,async(req,res)=>{
  try{
    const {trip_id,message=''}=req.body;
    const [t]=await pool.query('SELECT user_id FROM trips WHERE id=? AND status="open"',[trip_id]);
    if(!t.length) return res.status(404).json({message:'Trip is no longer available.'});
    if(t[0].user_id===req.user.id) return res.status(400).json({message:'You cannot request your own trip.'});
    const [r]=await pool.query('INSERT INTO join_requests(trip_id,requester_id,message) VALUES(?,?,?)',[trip_id,req.user.id,message]);
    res.status(201).json({id:r.insertId,message:'Request sent successfully.'});
  }catch(e){res.status(409).json({message:'You have already requested to join this trip.'});}
});
app.get('/api/requests',auth,async(req,res)=>{
  const [rows]=await pool.query(`SELECT jr.*,t.start_location,t.destination,t.travel_date,t.departure_time,t.transport,
    u.full_name AS requester_name,owner.full_name AS owner_name,t.user_id AS owner_id
    FROM join_requests jr JOIN trips t ON t.id=jr.trip_id JOIN users u ON u.id=jr.requester_id
    JOIN users owner ON owner.id=t.user_id
    WHERE t.user_id=? OR jr.requester_id=? ORDER BY jr.created_at DESC`,[req.user.id,req.user.id]);
  res.json(rows);
});
app.patch('/api/requests/:id',auth,async(req,res)=>{
  const {status}=req.body;
  if(!['accepted','rejected'].includes(status)) return res.status(400).json({message:'Invalid request status.'});
  const [rows]=await pool.query('SELECT jr.id,t.user_id,jr.status FROM join_requests jr JOIN trips t ON t.id=jr.trip_id WHERE jr.id=?',[req.params.id]);
  if(!rows.length||rows[0].user_id!==req.user.id) return res.status(404).json({message:'Request not found or not yours to manage.'});
  await pool.query('UPDATE join_requests SET status=? WHERE id=?',[status,req.params.id]);
  res.json({message:`Request ${status}.`});
});
app.get('/api/messages/:requestId',auth,async(req,res)=>{
  const [access]=await pool.query(`SELECT jr.id FROM join_requests jr JOIN trips t ON t.id=jr.trip_id WHERE jr.id=? AND (t.user_id=? OR jr.requester_id=?) AND jr.status='accepted'`,[req.params.requestId,req.user.id,req.user.id]);
  if(!access.length) return res.status(403).json({message:'Chat is available after a request is accepted.'});
  const [rows]=await pool.query(`SELECT m.*,u.full_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.request_id=? ORDER BY m.sent_at`,[req.params.requestId]);res.json(rows);
});
app.post('/api/messages/:requestId',auth,async(req,res)=>{
  const {message_text}=req.body;
  const [access]=await pool.query(`SELECT jr.id FROM join_requests jr JOIN trips t ON t.id=jr.trip_id WHERE jr.id=? AND (t.user_id=? OR jr.requester_id=?) AND jr.status='accepted'`,[req.params.requestId,req.user.id,req.user.id]);
  if(!access.length) return res.status(403).json({message:'Chat is available after a request is accepted.'});
  if(!message_text?.trim()) return res.status(400).json({message:'Message cannot be empty.'});
  await pool.query('INSERT INTO messages(request_id,sender_id,message_text) VALUES(?,?,?)',[req.params.requestId,req.user.id,message_text.trim()]);
  res.status(201).json({message:'Message sent.'});
});
app.get('/api/dashboard',auth,async(req,res)=>{
  const [[mine]]=await pool.query('SELECT COUNT(*) AS count FROM trips WHERE user_id=? AND status="open"',[req.user.id]);
  const [[available]]=await pool.query('SELECT COUNT(*) AS count FROM trips WHERE user_id<>? AND status="open"',[req.user.id]);
  const [[pending]]=await pool.query(`SELECT COUNT(*) AS count FROM join_requests jr JOIN trips t ON t.id=jr.trip_id WHERE (t.user_id=? OR jr.requester_id=?) AND jr.status='pending'`,[req.user.id,req.user.id]);
  const [[accepted]]=await pool.query(`SELECT COUNT(*) AS count FROM join_requests jr JOIN trips t ON t.id=jr.trip_id WHERE (t.user_id=? OR jr.requester_id=?) AND jr.status='accepted'`,[req.user.id,req.user.id]);
  res.json({my_trips:mine.count,available_trips:available.count,pending_requests:pending.count,accepted_requests:accepted.count});
});
app.post('/api/ratings',auth,async(req,res)=>{
  const {trip_id,reviewee_id,rating,comment=''}=req.body;
  if(rating<1||rating>5) return res.status(400).json({message:'Rating must be between 1 and 5.'});
  await pool.query('INSERT INTO ratings(trip_id,reviewer_id,reviewee_id,rating,comment) VALUES(?,?,?,?,?)',[trip_id,req.user.id,reviewee_id,rating,comment]);
  res.status(201).json({message:'Thank you for your review.'});
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Unexpected server error.'});});
const port=process.env.PORT||5000;
app.listen(port,()=>console.log(`RouteMate API running at http://localhost:${port}`));
