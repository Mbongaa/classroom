'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

function Tabs(props: React.PropsWithChildren<{}>) {
  const searchParams = useSearchParams();
  const tabIndex = searchParams?.get('tab') === 'custom' ? 1 : 0;

  const router = useRouter();
  function onTabSelected(index: number) {
    const tab = index === 1 ? 'custom' : 'demo';
    router.push(`/?tab=${tab}`);
  }

  let tabs = React.Children.map(props.children, (child, index) => {
    return (
      <button
        className="lk-button"
        onClick={() => {
          if (onTabSelected) {
            onTabSelected(index);
          }
        }}
        aria-pressed={tabIndex === index}
      >
        {/* @ts-ignore */}
        {child?.props.label}
      </button>
    );
  });

  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabSelect}>{tabs}</div>
      {/* @ts-ignore */}
      {props.children[tabIndex]}
    </div>
  );
}

function DemoMeetingTab(props: { label: string }) {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  const [roomCode, setRoomCode] = useState('');
  const [classroomPin, setClassroomPin] = useState('');
  const [showClassroomOptions, setShowClassroomOptions] = useState(false);

  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  const startClassroom = () => {
    const roomId = generateRoomId();
    // Teacher starts a new classroom with optional PIN
    let url = `/rooms/${roomId}?classroom=true&role=teacher`;
    if (classroomPin) {
      url += `&pin=${classroomPin}`;
    }
    router.push(url);
  };

  const [studentPin, setStudentPin] = useState('');

  const joinClassroomAsStudent = () => {
    if (!roomCode.trim()) {
      alert('Please enter a room code');
      return;
    }
    // Student joins existing classroom with room code and optional PIN
    let url = `/rooms/${roomCode}?classroom=true&role=student`;
    if (studentPin) {
      url += `&pin=${studentPin}`;
    }
    router.push(url);
  };

  return (
    <div className={styles.tabContent}>
      <p style={{ margin: 0 }}>Try LiveKit Meet for free with our live demo project.</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button className="lk-button" onClick={startMeeting}>
          Start Meeting
        </button>
        <button
          className="lk-button"
          onClick={() => setShowClassroomOptions(!showClassroomOptions)}
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Start Classroom (Teacher)
        </button>
      </div>

      {/* Classroom PIN option */}
      {showClassroomOptions && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(102, 126, 234, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(102, 126, 234, 0.3)',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.9rem', color: '#999' }}>
              Optional PIN (4-6 digits):
            </label>
            <input
              type="text"
              placeholder="Leave empty for no PIN"
              value={classroomPin}
              onChange={(e) => setClassroomPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                padding: '0.5rem',
                marginLeft: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#1a1d21',
                color: 'white',
                width: '150px',
              }}
            />
          </div>
          <button
            className="lk-button"
            onClick={startClassroom}
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            Create Classroom {classroomPin && `(PIN: ${classroomPin})`}
          </button>
        </div>
      )}

      {/* Student join section */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          background: 'rgba(240, 147, 251, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(240, 147, 251, 0.3)',
        }}
      >
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#f093fb' }}>
          Join Classroom as Student
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Enter room code (e.g., abc-def-ghi)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !studentPin) {
                joinClassroomAsStudent();
              }
            }}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              flex: 1,
              minWidth: '200px',
              background: '#1a1d21',
              color: 'white',
            }}
          />
          <input
            type="text"
            placeholder="PIN (if required)"
            value={studentPin}
            onChange={(e) => setStudentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                joinClassroomAsStudent();
              }
            }}
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              width: '120px',
              background: '#1a1d21',
              color: 'white',
            }}
          />
          <button
            className="lk-button"
            onClick={joinClassroomAsStudent}
            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
          >
            Join as Student
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.5rem' }}>
          Ask your teacher for the room code and PIN (if required) to join the classroom
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></input>
          <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
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

function CustomConnectionTab(props: { label: string }) {
  const router = useRouter();

  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const serverUrl = formData.get('serverUrl');
    const token = formData.get('token');
    if (e2ee) {
      router.push(
        `/custom/?liveKitUrl=${serverUrl}&token=${token}#${encodePassphrase(sharedPassphrase)}`,
      );
    } else {
      router.push(`/custom/?liveKitUrl=${serverUrl}&token=${token}`);
    }
  };
  return (
    <form className={styles.tabContent} onSubmit={onSubmit}>
      <p style={{ marginTop: 0 }}>
        Connect LiveKit Meet with a custom server using LiveKit Cloud or LiveKit Server.
      </p>
      <input
        id="serverUrl"
        name="serverUrl"
        type="url"
        placeholder="LiveKit Server URL: wss://*.livekit.cloud"
        required
      />
      <textarea
        id="token"
        name="token"
        placeholder="Token"
        required
        rows={5}
        style={{ padding: '1px 2px', fontSize: 'inherit', lineHeight: 'inherit' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></input>
          <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
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

      <hr
        style={{ width: '100%', borderColor: 'rgba(255, 255, 255, 0.15)', marginBlock: '1rem' }}
      />
      <button
        style={{ paddingInline: '1.25rem', width: '100%' }}
        className="lk-button"
        type="submit"
      >
        Connect
      </button>
    </form>
  );
}

export default function Page() {
  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <div className="header">
          <img src="/images/livekit-meet-home.svg" alt="LiveKit Meet" width="360" height="45" />
          <h2>
            Open source video conferencing app built on{' '}
            <a href="https://github.com/livekit/components-js?ref=meet" rel="noopener">
              LiveKit&nbsp;Components
            </a>
            ,{' '}
            <a href="https://livekit.io/cloud?ref=meet" rel="noopener">
              LiveKit&nbsp;Cloud
            </a>{' '}
            and Next.js.
          </h2>
        </div>
        <Suspense fallback="Loading">
          <Tabs>
            <DemoMeetingTab label="Demo" />
            <CustomConnectionTab label="Custom" />
          </Tabs>
        </Suspense>
      </main>
      <footer data-lk-theme="default">
        Hosted on{' '}
        <a href="https://livekit.io/cloud?ref=meet" rel="noopener">
          LiveKit Cloud
        </a>
        . Source code on{' '}
        <a href="https://github.com/livekit/meet?ref=meet" rel="noopener">
          GitHub
        </a>
        .
      </footer>
    </>
  );
}
