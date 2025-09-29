'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { generateRoomId, randomString } from '@/lib/client-utils';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { Input } from '@/components/ui/input';
import styles from '../styles/Home.module.css';


function DemoMeetingTab(props: { label: string }) {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  const [roomCode, setRoomCode] = useState('');
  const [showRoomCodeInput, setShowRoomCodeInput] = useState(false);
  const [speechRoomCode, setSpeechRoomCode] = useState('');
  const [showSpeechRoomCodeInput, setShowSpeechRoomCodeInput] = useState(false);

  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  const startClassroom = () => {
    const roomId = generateRoomId();
    router.push(`/rooms/${roomId}?classroom=true&role=teacher`);
  };

  const startSpeechSession = () => {
    const roomId = generateRoomId();
    router.push(`/rooms/${roomId}?speech=true&role=teacher`);
  };

  const handleJoinAsStudent = () => {
    if (!showRoomCodeInput) {
      // Show the input field
      setShowRoomCodeInput(true);
    } else if (roomCode.trim()) {
      // Join the room if room code is provided
      router.push(`/rooms/${roomCode}?classroom=true&role=student`);
    } else {
      alert('Please enter a room code');
    }
  };

  const handleJoinAsSpeechStudent = () => {
    if (!showSpeechRoomCodeInput) {
      // Show the input field
      setShowSpeechRoomCodeInput(true);
    } else if (speechRoomCode.trim()) {
      // Join the room if room code is provided
      router.push(`/rooms/${speechRoomCode}?speech=true&role=student`);
    } else {
      alert('Please enter a room code');
    }
  };

  return (
    <div className={styles.tabContent}>
      <p className="text-black dark:text-white" style={{ margin: 0 }}>Start or join a video conference session.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
        <button
          onClick={startMeeting}
          className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
        >
          Start Meeting
        </button>
        <button
          onClick={startClassroom}
          className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
        >
          Start Classroom (Teacher)
        </button>

        <button
          onClick={handleJoinAsStudent}
          className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
        >
          Join as Student
        </button>

        <button
          onClick={startSpeechSession}
          className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
        >
          Start Speech Session (Teacher)
        </button>

        <button
          onClick={handleJoinAsSpeechStudent}
          className="flex min-w-[120px] cursor-pointer items-center justify-center gap-2 rounded-full bg-black text-white dark:bg-white dark:text-black px-4 py-2 font-medium ring-offset-2 transition duration-200 hover:ring-2 hover:ring-black hover:ring-offset-white dark:hover:ring-white dark:ring-offset-black"
        >
          Join Speech Session (Student)
        </button>

        {/* Dynamic room code input */}
        {showRoomCodeInput && (
          <div style={{
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            alignItems: 'center',
            animation: 'fadeIn 0.3s ease-in-out'
          }}>
            <Input
              type="text"
              placeholder="Enter room code (e.g., abc-def-ghi)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleJoinAsStudent();
                }
              }}
              autoFocus
              className="text-center"
              style={{ minWidth: '250px', backgroundColor: 'transparent' }}
            />
            <p className="text-gray-600 dark:text-gray-400" style={{
              fontSize: '0.85rem',
              margin: 0,
              textAlign: 'center'
            }}>
              Ask your teacher for the room code
            </p>
          </div>
        )}

        {/* Dynamic speech room code input */}
        {showSpeechRoomCodeInput && (
          <div style={{
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            alignItems: 'center',
            animation: 'fadeIn 0.3s ease-in-out'
          }}>
            <Input
              type="text"
              placeholder="Enter speech session code (e.g., abc-def-ghi)"
              value={speechRoomCode}
              onChange={(e) => setSpeechRoomCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleJoinAsSpeechStudent();
                }
              }}
              autoFocus
              className="text-center"
              style={{ minWidth: '250px', backgroundColor: 'transparent' }}
            />
            <p className="text-gray-600 dark:text-gray-400" style={{
              fontSize: '0.85rem',
              margin: 0,
              textAlign: 'center'
            }}>
              Ask your speech teacher for the session code
            </p>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></input>
          <label htmlFor="use-e2ee" className="text-black dark:text-white">Enable end-to-end encryption</label>
        </div>
        {e2ee && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              type="password"
              value={sharedPassphrase}
              onChange={(ev) => setSharedPassphrase(ev.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}


export default function Page() {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }} data-lk-theme="default">
        {/* Unified Header */}
        <div style={{
          height: '56px',
          background: 'var(--lk-bg, #000000)',
          borderBottom: '1px solid rgba(128, 128, 128, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0
        }}>
          <span style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--foreground)',
            letterSpacing: '-0.03rem'
          }}>
            bayaan.ai
          </span>
          <ThemeToggleButton start="top-right" />
        </div>

        {/* Main Content */}
        <main className={styles.main}>
          <Suspense fallback="Loading">
            <DemoMeetingTab label="Demo" />
          </Suspense>
        </main>

      </div>
    </>
  );
}
