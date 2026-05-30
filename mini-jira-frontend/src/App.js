import React, { useState, useEffect } from 'react'
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
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
  if (page === 'signup') return <Signup userPool={userPool} setPage={setPage} showToast={showToast} />
  
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
        <button className="btn btn-primary" style={{width:'100%', marginBottom:'1rem'}} onClick={login} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <p style={{textAlign:'center', fontSize:'14px', color:'#666'}}>
          Don't have an account? <span style={{color:'#1e3a5f', cursor:'pointer', fontWeight:'bold'}} onClick={() => setPage('signup')}>Sign Up</span>
        </p>
      </div>
    </div>
  )
}

function Signup({ userPool, setPage, showToast }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('employee')
  const [teamId, setTeamId] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const signup = () => {
    if (!email || !password || !teamId) return setError('Please fill all fields')
    setLoading(true)
    setError('')
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'custom:role', Value: role }),
      new CognitoUserAttribute({ Name: 'custom:teamId', Value: teamId }),
    ]
    userPool.signUp(email, password, attributes, null, (err, result) => {
      setLoading(false)
      if (err) return setError(err.message)
      setStep('confirm')
      showToast('Account created! Check your email for verification code.')
    })
  }

  const confirm = () => {
    setLoading(true)
    setError('')
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool })
    cognitoUser.confirmRegistration(code, true, (err) => {
      setLoading(false)
      if (err) return setError(err.message)
      showToast('Account verified! Please login.')
      setPage('login')
    })
  }

  if (step === 'confirm') return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh'}}>
      <div className="card" style={{width:'400px'}}>
        <h2 style={{marginBottom:'1.5rem', textAlign:'center'}}>Verify Email</h2>
        <p style={{marginBottom:'1rem', color:'#666', fontSize:'14px'}}>Enter the verification code sent to {email}</p>
        <div className="form-group">
          <label>Verification Code</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="Enter code" />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" style={{width:'100%', marginBottom:'1rem'}} onClick={confirm} disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh'}}>
      <div className="card" style={{width:'400px'}}>
        <h2 style={{marginBottom:'1.5rem', textAlign:'center'}}>🚀 Create Account</h2>
        <div className="form-group">
          <label>Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email" />
        </div>
        <div className="form-group">
          <label>Password *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, uppercase, number, symbol" />
        </div>
        <div className="form-group">
          <label>Role *</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <div className="form-group">
          <label>Team *</label>
          <input type="text" value={teamId} onChange={e => setTeamId(e.target.value)} placeholder="e.g. Frontend, Backend, QA" />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" style={{width:'100%', marginBottom:'1rem'}} onClick={signup} disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
        <p style={{textAlign:'center', fontSize:'14px', color:'#666'}}>
          Already have an account? <span style={{color:'#1e3a5f', cursor:'pointer', fontWeight:'bold'}} onClick={() => setPage('login')}>Login</span>
        </p>
      </div>
    </div>
  )
}
 
function Dashboard({ token, user, showToast, setPage }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [teamFilter, setTeamFilter] = useState('all')
 
  useEffect(() => {
    fetch(`${API_URL}/api/tasks`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])
 
  const statuses = ['To Do', 'In Progress', 'In Review', 'Done']
  const teams = [...new Set(tasks.map(t => t.teamId).filter(Boolean))]
  const filteredTasks = teamFilter === 'all' ? tasks : tasks.filter(t => t.teamId === teamFilter)
 
  const updateStatus = async (taskId, newStatus) => {
    await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    setTasks(tasks.map(t => t.taskId === taskId ? { ...t, status: newStatus } : t))
    showToast('Task updated!')
  }

  const deleteTask = async (taskId, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this task?')) return
    await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    setTasks(tasks.filter(t => t.taskId !== taskId))
    showToast('Task deleted!')
  }

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId) return
    const newStatus = destination.droppableId
    updateStatus(draggableId, newStatus)
  }
 
  if (loading) return <p style={{padding:'2rem'}}>Loading tasks...</p>
 
  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 0'}}>
        <h2>Kanban Board</h2>
        {user.role === 'manager' && (
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <label style={{fontSize:'14px'}}>Filter by team:</label>
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #ddd'}}>
              <option value="all">All Teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban">
          {statuses.map(status => (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div
                  className="kanban-col"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    background: snapshot.isDraggingOver ? '#e8f4fd' : undefined,
                    transition: 'background 0.2s'
                  }}
                >
                  <h3>{status} ({filteredTasks.filter(t => t.status === status).length})</h3>
                  {filteredTasks.filter(t => t.status === status).map((task, index) => (
                    <Draggable draggableId={task.taskId} index={index} key={task.taskId}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="task-card"
                          onClick={() => setSelectedTask(task)}
                          style={{
                            ...provided.draggableProps.style,
                            boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.2)' : undefined,
                            opacity: snapshot.isDragging ? 0.9 : 1
                          }}
                        >
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                            <p style={{fontWeight:'bold', marginBottom:'4px'}}>{task.title}</p>
                            {user.role === 'manager' && (
                              <button className="btn btn-danger" style={{padding:'2px 6px', fontSize:'11px'}} onClick={e => deleteTask(task.taskId, e)}>✕</button>
                            )}
                          </div>
                          <p style={{fontSize:'12px', color:'#666', marginBottom:'4px'}}>{task.assignee}</p>
                          <p style={{fontSize:'11px', color:'#999', marginBottom:'6px'}}>Team: {task.teamId}</p>
                          <span className={`badge badge-${task.priority?.toLowerCase()}`}>{task.priority}</span>
                          {task.deadline && <p style={{fontSize:'11px', color:'#999', marginTop:'4px'}}>📅 {task.deadline}</p>}
                          {task.imageUrl && <img src={task.imageUrl} alt="task" style={{width:'100%', marginTop:'8px', borderRadius:'4px', maxHeight:'120px', objectFit:'cover'}} />}
                          {user.role !== 'manager' && (
                            <div style={{marginTop:'8px'}} onClick={e => e.stopPropagation()}>
                              <select style={{fontSize:'12px', padding:'2px', width:'100%'}} value={task.status} onChange={e => updateStatus(task.taskId, e.target.value)}>
                                {statuses.map(s => <option key={s}>{s}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {filteredTasks.filter(t => t.status === status).length === 0 && (
                    <p style={{color:'#ccc', fontSize:'13px', textAlign:'center', padding:'1rem'}}>Drop tasks here</p>
                  )}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
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
        <div style={{marginBottom:'1rem'}}>
          <label style={{fontSize:'14px', marginRight:'8px'}}>Update Status:</label>
          <select onChange={e => updateStatus(task.taskId, e.target.value)} defaultValue={task.status}>
            {['To Do','In Progress','In Review','Done'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <h3 style={{marginBottom:'8px'}}>Comments</h3>
        {comments.length === 0 && <p style={{color:'#999', fontSize:'13px'}}>No comments yet.</p>}
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

  const deleteProject = async (projectId) => {
    if (!window.confirm('Delete this project?')) return
    await fetch(`${API_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    setProjects(projects.filter(p => p.projectId !== projectId))
    showToast('Project deleted!')
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
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn btn-primary" onClick={create}>Create</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="grid">
        {projects.map(p => (
          <div key={p.projectId} className="card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <h3>{p.name}</h3>
              {user.role === 'manager' && (
                <button className="btn btn-danger" style={{padding:'2px 8px', fontSize:'12px'}} onClick={() => deleteProject(p.projectId)}>Delete</button>
              )}
            </div>
            <p style={{color:'#666', fontSize:'14px'}}>{p.description}</p>
          </div>
        ))}
        {projects.length === 0 && <p style={{color:'#999'}}>No projects yet.</p>}
      </div>
    </div>
  )
}
 
export default App
