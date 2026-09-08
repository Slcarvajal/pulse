// App shell — black full-height container, owns data/loading/error/tab state, live polling (SPEC §7.16).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getHealth, getLive } from './api.js';
import { MOTION } from './theme.js';
import TabBar from './components/TabBar.jsx';
import Skeleton from './components/Skeleton.jsx';
import StaleBanner from './components/StaleBanner.jsx';
import Home from './screens/Home.jsx';
import Recovery from './screens/Recovery.jsx';
import Strain from './screens/Strain.jsx';
import Sleep from './screens/Sleep.jsx';
import Health from './screens/Health.jsx';
import Trends from './screens/Trends.jsx';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function ConnectScreen({ authUrl }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col px-6" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
      <span className="lbl">Pulse</span>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <a
          href={authUrl || '/api/auth'}
          className="lbl-lg"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '16px 32px',
            color: '#F5F7FA',
            background: 'transparent',
            textDecoration: 'none',
          }}
        >
          Connect Google
        </a>
        <span className="lbl" style={{ color: '#6B7280' }}>Read-only access to your Fitbit data</span>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('home');
  const dataRef = useRef(null);
  dataRef.current = data;

  function load({ refresh } = {}) {
    if (refresh) setRefreshing(true);
    return getHealth({ refresh })
      .then((body) => {
        setData(body);
        setError(null);
      })
      .catch(setError)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  function pollLive() {
    getLive()
      .then((body) => {
        if (body && (body.hrDay || body.latestHr)) setLive(body);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = Boolean(data && data.today);

  useEffect(() => {
    if (!ready) return undefined;
    let interval = null;

    function start() {
      pollLive();
      interval = setInterval(pollLive, 60000);
    }

    function stop() {
      if (interval) clearInterval(interval);
      interval = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        pollLive();
        const generatedAt = dataRef.current?.generatedAt;
        if (generatedAt && Date.now() - new Date(generatedAt).getTime() > SIX_HOURS_MS) {
          load();
        }
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const needsAuth = Boolean(data?.needsAuth) || error?.status === 401;
  const liveHrDayValid = Array.isArray(live?.hrDay) && live.hrDay.length > 0;
  const liveLatestHrValid = Boolean(live?.latestHr) && typeof live.latestHr === 'object' && live.latestHr.bpm != null;
  const merged = data && live && (liveHrDayValid || liveLatestHrValid)
    ? {
        ...data,
        latestHr: liveLatestHrValid ? live.latestHr : data.latestHr,
        hrDay: liveHrDayValid ? live.hrDay : data.hrDay,
      }
    : data;
  const showSkeleton = loading && !data;
  const showConnect = !showSkeleton && needsAuth;
  const showError = !showSkeleton && !showConnect && !data && error;
  const showScreens = !showSkeleton && !showConnect && !!merged;

  function onNavigate(next) {
    setTab(next);
  }

  return (
    <div className="min-h-screen bg-bg text-text font-sans">
      {showSkeleton && <Skeleton />}
      {showConnect && <ConnectScreen authUrl={data?.authUrl ?? error?.authUrl} />}
      {showScreens && (
        <>
          {merged.stale && <StaleBanner />}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.tab.duration }}
            >
              {tab === 'home' && (
                <Home data={merged} onRefresh={() => load({ refresh: true })} refreshing={refreshing} onNavigate={onNavigate} />
              )}
              {tab === 'recovery' && <Recovery data={merged} />}
              {tab === 'strain' && <Strain data={merged} />}
              {tab === 'sleep' && <Sleep data={merged} />}
              {tab === 'health' && <Health data={merged} />}
              {tab === 'trends' && <Trends data={merged} onBack={() => setTab('home')} />}
            </motion.div>
          </AnimatePresence>
          <TabBar active={tab} onChange={setTab} />
        </>
      )}
      {showError && (
        <div className="min-h-screen flex items-center justify-center px-6">
          <p className="lbl" style={{ color: '#FF0026' }}>Failed to load Pulse data.</p>
        </div>
      )}
    </div>
  );
}
