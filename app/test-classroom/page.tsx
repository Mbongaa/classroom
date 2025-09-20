'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId } from '@/lib/client-utils';

// Test page for classroom functionality - NOT FOR PRODUCTION
export default function TestClassroomPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState(generateRoomId());
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchTestUrls = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/test-classroom?roomName=${roomName}`);
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Error fetching test URLs:', error);
      setTestResults({ error: 'Failed to fetch test URLs' });
    }
    setLoading(false);
  };

  const joinAsTeacher = () => {
    // Navigate to existing room page with classroom params
    router.push(`/rooms/${roomName}?classroom=true&role=teacher`);
  };

  const joinAsStudent = () => {
    // Navigate to existing room page with classroom params
    router.push(`/rooms/${roomName}?classroom=true&role=student`);
  };

  const joinAsRegular = () => {
    // Navigate to existing room page without classroom params
    router.push(`/rooms/${roomName}`);
  };

  return (
    <main data-lk-theme="default" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Classroom Test Page</h1>
      <p style={{ color: 'orange', marginBottom: '2rem' }}>
        ⚠️ This is a test page for development only - not for production use
      </p>

      <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f0f0f0', borderRadius: '8px' }}>
        <h2>Test Room Setup</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>Room Name: </label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          />
          <button
            onClick={() => setRoomName(generateRoomId())}
            style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem' }}
          >
            Generate New
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Quick Join Options</h2>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            className="lk-button"
            onClick={joinAsTeacher}
            style={{ flex: 1, background: '#4CAF50' }}
          >
            Join as Teacher
            <br />
            <small>(Can publish audio/video)</small>
          </button>
          <button
            className="lk-button"
            onClick={joinAsStudent}
            style={{ flex: 1, background: '#2196F3' }}
          >
            Join as Student
            <br />
            <small>(Cannot publish media)</small>
          </button>
          <button
            className="lk-button"
            onClick={joinAsRegular}
            style={{ flex: 1 }}
          >
            Join Regular Room
            <br />
            <small>(Full permissions)</small>
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Generate Test URLs</h2>
        <button
          className="lk-button"
          onClick={fetchTestUrls}
          disabled={loading}
          style={{ marginBottom: '1rem' }}
        >
          {loading ? 'Generating...' : 'Generate Test URLs'}
        </button>

        {testResults && (
          <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
            <h3>Test URLs Generated:</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.9rem' }}>
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#e8f4fd', borderRadius: '8px' }}>
        <h3>Testing Instructions:</h3>
        <ol>
          <li>Open this page in multiple browsers (Chrome, Firefox, Edge)</li>
          <li>Join the same room with different roles</li>
          <li>Verify permissions:
            <ul>
              <li>Teacher: Can enable camera and microphone</li>
              <li>Student: Camera and mic buttons should be disabled</li>
              <li>Both: Can use chat functionality</li>
            </ul>
          </li>
          <li>Check the browser console for any errors</li>
          <li>Optionally check LiveKit dashboard for token grants</li>
        </ol>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button
          className="lk-button"
          onClick={() => router.push('/')}
          style={{ background: '#666' }}
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}