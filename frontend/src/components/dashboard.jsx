import React, { useState, useEffect } from 'react';
import './styles/dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [newFilename, setNewFilename] = useState('');

  // Fetch files from API
  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://perdrive-api.onrender.com/api/files', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
      } else {
        console.error('Error fetching files:', data.message);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  // Handler functions for actions
  const handleEdit = (fileId, currentFilename) => {
    setEditingFileId(fileId);
    setNewFilename(currentFilename.replace(/\.[^/.]+$/, "")); // Remove extension for editing
  };

  const handleSaveEdit = async (fileId) => {
    if (!newFilename.trim()) {
      alert('Please enter a filename');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://perdrive-api.onrender.com/api/files/${fileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newFilename }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Update the files state
        setFiles(files.map(file => 
          file.id === fileId 
            ? { ...file, filename: data.file.filename }
            : file
        ));
        setEditingFileId(null);
        setNewFilename('');
        alert('File renamed successfully');
      } else {
        alert('Error renaming file: ' + data.message);
      }
    } catch (error) {
      console.error('Error renaming file:', error);
      alert('Error renaming file');
    }
  };

  const handleCancelEdit = () => {
    setEditingFileId(null);
    setNewFilename('');
  };

  const handleDelete = async (fileId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://perdrive-api.onrender.com/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setFiles(files.filter(file => file.id !== fileId));
        alert('File deleted successfully');
      } else {
        alert('Error deleting file: ' + data.message);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file');
    }
  };

  const handleDownload = async (fileId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://perdrive-api.onrender.com/api/files/download/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        // Use the filename from the dashboard (displayName)
        const file = files.find(f => f.id === fileId);
        a.download = file ? file.filename : 'file';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error downloading file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    }
  };

  const handleAddNew = () => {
    setShowUploadModal(true);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      setUploadProgress(0);

      const response = await fetch('https://perdrive-api.onrender.com/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        alert('File uploaded successfully');
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadProgress(0);
        fetchFiles(); // Refresh the file list
      } else {
        alert('Error uploading file: ' + data.message);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  };

  const closeModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadProgress(0);
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <p>Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome to your Dashboard, {user.username}!</h1>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>

      <div className="dashboard-actions">
        <button className="add-new-btn" onClick={handleAddNew}>
          + Add New
        </button>
      </div>

      <div className="dashboard-table-container">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Date</th>
              <th>Size</th>
              <th>Owner</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td className="filename-cell">
                  {editingFileId === file.id ? (
                    <div className="edit-filename-container">
                      <input
                        type="text"
                        value={newFilename}
                        onChange={(e) => setNewFilename(e.target.value)}
                        className="filename-input"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(file.id);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    file.filename
                  )}
                </td>
                <td>{file.date}</td>
                <td>{file.size}</td>
                <td>{file.owner}</td>
                <td>
                  <div className="action-buttons">
                    {editingFileId === file.id ? (
                      <>
                        <button
                          className="action-btn save-btn"
                          onClick={() => handleSaveEdit(file.id)}
                          title="Save"
                        >
                          Save
                        </button>
                        <button
                          className="action-btn cancel-btn"
                          onClick={handleCancelEdit}
                          title="Cancel"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {file.owner === user.username && (
                          <>
                            <button
                              className="action-btn edit-btn"
                              onClick={() => handleEdit(file.id, file.filename)}
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              className="action-btn delete-btn"
                              onClick={() => handleDelete(file.id)}
                              title="Delete"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        <button
                          className="action-btn download-btn"
                          onClick={() => handleDownload(file.id)}
                          title="Download"
                        >
                          Download
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {files.length === 0 && (
          <div className="no-files">
            <p>No files found. Click "Add New" to upload your first file.</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Upload File</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="file-upload-area">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.apk"
                />
                <label htmlFor="file-upload" className="file-upload-label">
                  {selectedFile ? selectedFile.name : 'Click to select a file'}
                </label>
              </div>
              {selectedFile && (
                <div className="file-info">
                  <p><strong>Selected:</strong> {selectedFile.name}</p>
                  <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Type:</strong> {selectedFile.type || 'Unknown'}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeModal}>Cancel</button>
              <button 
                className="upload-btn" 
                onClick={handleUpload}
                disabled={!selectedFile}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;