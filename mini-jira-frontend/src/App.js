import React, { useState, useEffect } from 'react'
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js'
import { cognitoConfig, API_URL } from './aws-config'
import './App.css'
 
const userPool = new CognitoUserPool(cognitoConfig)
 
function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [page, setPage] = useState('login')
  const [toast, setToast] = useState(null)
 
  useEffect(() => {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.getSession((err, session) => {
        if (!err && session.isValid()) {
          const payload = session.getIdToken().decodePayload()
          setToken(session.getIdToken().getJwtToken())
          setUser({ email: payload.email, role: payload['custom:role'], teamId: payload['custom:teamId'] })
          setPage('dashboard')
        }
      })
    }
  }, [])
 
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
 
  const logout = () => {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) cognitoUser.signOut()
    setUser(null)
    setToken(null)
    setPage('login')
  }
 
  if (page === 'login') return <Login userPool={userPool} setUser={setUser} setToken={setToken} setPage={setPage} showToast={showToast} />
  
  return (
    <div>
      <nav className="navbar">
        <h1>🚀 Mini Jira</h1>
        <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
          <span>{user?.email} ({user?.role})</span>
          <button className="btn" style={{background:'white',color:'#1e3a5f'}} onClick={logout}>Logout</button>
        </div>
      </nav>
      <div style={{display:'flex', gap:'1rem', padding:'1rem', background:'white', borderBottom:'1px solid #eee'}}>
        <button className="btn btn-primary" onClick={() => setPage('dashboard')}>Dashboard</button>
        {user?.role === 'manager' && <button className="btn btn-primary" onClick={() => setPage('create-task')}>+ New Task</button>}
        {user?.role === 'manager' && <button className="btn btn-primary" onClick={() => setPage('projects')}>Projects</button>}
      </div>
      <div className="container">
        {page === 'dashboard' && <Dashboard token={token} user={user} showToast={showToast} setPage={setPage} />}
        {page === 'create-task' && <CreateTask token={token} user={user} showToast={showToast} setPage={setPage} />}
        {page === 'projects' && <Projects token={token} user={user} showToast={showToast} />}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
 
function Login({ userPool, setUser, setToken, setPage, showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
 
  const login = () => {
    setLoading(true)
    setError('')
    const authDetails = new AuthenticationDetails({ Username: email, Password: password })
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        const payload = session.getIdToken().decodePayload()
        setToken(session.getIdToken().getJwtToken())
        setUser({ email: payload.email, role: payload['custom:role'], teamId: payload['custom:teamId'] })
        setPage('dashboard')
        setLoading(false)
      },
      onFailure: (err) => {
        setError(err.message)
        setLoading(false)
      },
      newPasswordRequired: (userAttributes) => {
        cognitoUser.completeNewPasswordChallenge(password, {}, {
          onSuccess: (session) => {
            const payload = session.getIdToken().decodePayload()
            setToken(session.getIdToken().getJwtToken())
            setUser({ email: payload.email, role: payload['custom:role'], teamId: payload['custom:teamId'] })
            setPage('dashboard')
            setLoading(false)
          },
          onFailure: (err) => {
            setError(err.message)
            setLoading(false)
          }
        })
      }
    })
  }
 
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh'}}>
      <div className="card" style={{width:'400px'}}>
        <h2 style={{marginBottom:'1.5rem', textAlign:'center'}}>🚀 Mini Jira</h2>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" onKeyPress={e => e.key === 'Enter' && login()} />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" style={{width:'100%'}} onClick={login} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </div>
  )
}
 
function Dashboard({ token, user, showToast, setPage }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
 
  useEffect(() => {
    fetch(`${API_URL}/api/tasks`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])
 
  const statuses = ['To Do', 'In Progress', 'In Review', 'Done']
 
  const updateStatus = async (taskId, newStatus) => {
    await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    setTasks(tasks.map(t => t.taskId === taskId ? { ...t, status: newStatus } : t))
    showToast('Task updated!')
  }
 
  if (loading) return <p style={{padding:'2rem'}}>Loading tasks...</p>
 
  return (
    <div>
      <h2 style={{padding:'1rem 0'}}>Kanban Board</h2>
      <div className="kanban">
        {statuses.map(status => (
          <div key={status} className="kanban-col">
            <h3>{status} ({tasks.filter(t => t.status === status).length})</h3>
            {tasks.filter(t => t.status === status).map(task => (
              <div key={task.taskId} className="task-card" onClick={() => setSelectedTask(task)}>
                <p style={{fontWeight:'bold', marginBottom:'4px'}}>{task.title}</p>
                <p style={{fontSize:'12px', color:'#666', marginBottom:'6px'}}>{task.assignee}</p>
                <span className={`badge badge-${task.priority?.toLowerCase()}`}>{task.priority}</span>
                {task.imageUrl && <img src={task.imageUrl} alt="task" style={{width:'100%', marginTop:'8px', borderRadius:'4px', maxHeight:'120px', objectFit:'cover'}} />}
                {user.role !== 'manager' && (
                  <div style={{marginTop:'8px'}}>
                    <select style={{fontSize:'12px', padding:'2px'}} value={task.status} onChange={e => { e.stopPropagation(); updateStatus(task.taskId, e.target.value) }} onClick={e => e.stopPropagation()}>
                      {statuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {selectedTask && <TaskModal task={selectedTask} token={token} user={user} onClose={() => setSelectedTask(null)} updateStatus={updateStatus} showToast={showToast} />}
    </div>
  )
}
 
function TaskModal({ task, token, onClose, updateStatus, user, showToast }) {
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
 
  useEffect(() => {
    fetch(`${API_URL}/api/comments/${task.taskId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setComments(Array.isArray(data) ? data : []))
  }, [task.taskId, token])
 
  const addComment = async () => {
    if (!comment.trim()) return
    const res = await fetch(`${API_URL}/api/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.taskId, text: comment })
    })
    const data = await res.json()
    setComments([...comments, data])
    setComment('')
    showToast('Comment added!')
  }
 
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem'}}>
          <h2>{task.title}</h2>
          <button className="btn" onClick={onClose}>✕</button>
        </div>
        <p style={{marginBottom:'8px'}}>{task.description}</p>
        <p style={{fontSize:'14px', color:'#666', marginBottom:'4px'}}>Assignee: {task.assignee}</p>
        <p style={{fontSize:'14px', color:'#666', marginBottom:'4px'}}>Team: {task.teamId}</p>
        <p style={{fontSize:'14px', color:'#666', marginBottom:'4px'}}>Deadline: {task.deadline}</p>
        <p style={{fontSize:'14px', color:'#666', marginBottom:'1rem'}}>Status: {task.status}</p>
        {task.imageUrl && <img src={task.imageUrl} alt="task" style={{width:'100%', marginBottom:'1rem', borderRadius:'6px', maxHeight:'200px', objectFit:'cover'}} />}
        {user.role === 'manager' && (
          <div style={{marginBottom:'1rem'}}>
            <select onChange={e => updateStatus(task.taskId, e.target.value)} defaultValue={task.status}>
              {['To Do','In Progress','In Review','Done'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        <h3 style={{marginBottom:'8px'}}>Comments</h3>
        {comments.map(c => (
          <div key={c.commentId} className="card" style={{padding:'8px', marginBottom:'8px'}}>
            <p style={{fontSize:'13px'}}>{c.text}</p>
            <p style={{fontSize:'11px', color:'#999'}}>{c.createdAt}</p>
          </div>
        ))}
        <div style={{display:'flex', gap:'8px', marginTop:'1rem'}}>
          <input style={{flex:1, padding:'8px', border:'1px solid #ddd', borderRadius:'6px'}} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..." />
          <button className="btn btn-primary" onClick={addComment}>Send</button>
        </div>
      </div>
    </div>
  )
}
 
function CreateTask({ token, showToast, setPage }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'Medium', deadline: '', assignee: '', teamId: '' })
  const [image, setImage] = useState(null)

  const submit = async () => {
    if (!form.title || !form.assignee || !form.teamId) return showToast('Fill all required fields', 'error')
    
    let imageUrl = null
    if (image) {
      const formData = new FormData()
      formData.append('image', image)
      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const uploadData = await uploadRes.json()
      imageUrl = uploadData.imageUrl
    }

    const res = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, imageUrl })
    })
    if (res.ok) { showToast('Task created!'); setPage('dashboard') }
    else showToast('Error creating task', 'error')
  }
 
  return (
    <div style={{maxWidth:'600px', margin:'2rem auto'}}>
      <div className="card">
        <h2 style={{marginBottom:'1.5rem'}}>Create New Task</h2>
        {['title','description','assignee','teamId','deadline'].map(field => (
          <div className="form-group" key={field}>
            <label>{field.charAt(0).toUpperCase() + field.slice(1)}{field !== 'description' ? ' *' : ''}</label>
            {field === 'description' 
              ? <textarea rows={3} value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})} />
              : <input type={field === 'deadline' ? 'date' : 'text'} value={form[field]} onChange={e => setForm({...form, [field]: e.target.value})} />
            }
          </div>
        ))}
        <div className="form-group">
          <label>Priority</label>
          <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
            <option>Low</option><option>Medium</option><option>High</option>
          </select>
        </div>
        <div className="form-group">
          <label>Image (optional)</label>
          <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} />
        </div>
        <div style={{display:'flex', gap:'1rem'}}>
          <button className="btn btn-primary" onClick={submit}>Create Task</button>
          <button className="btn" onClick={() => setPage('dashboard')}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
 
function Projects({ token, user, showToast }) {
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
 
  useEffect(() => {
    fetch(`${API_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
  }, [token])
 
  const create = async () => {
    const res = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setProjects([...projects, data])
    setShowForm(false)
    showToast('Project created!')
  }
 
  return (
    <div style={{padding:'1rem 0'}}>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem'}}>
        <h2>Projects</h2>
        {user.role === 'manager' && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Project</button>}
      </div>
      {showForm && (
        <div className="card" style={{marginBottom:'1rem'}}>
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      )}
      <div className="grid">
        {projects.map(p => (
          <div key={p.projectId} className="card">
            <h3>{p.name}</h3>
            <p style={{color:'#666', fontSize:'14px'}}>{p.description}</p>
          </div>
        ))}
        {projects.length === 0 && <p style={{color:'#999'}}>No projects yet.</p>}
      </div>
    </div>
  )
}
 
export default App
