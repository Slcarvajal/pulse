// App shell — black full-height container, owns data/loading/error state, tab routing.
import { useEffect, useState } from 'react';
import { getHealth } from './api.js';
import TabBar from './components/TabBar.jsx';
import Today from './screens/Today.jsx';
import Sleep from './screens/Sleep.jsx';
import Trends from './screens/Trends.jsx';

function SkeletonBlock({ className }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

function Skeleton() {
  return (
    <div className="px-4 pt-6 pb-24 flex flex-col items-center gap-8 min-h-screen">
      <div className="w-full flex items-center justify-between">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-5 w-5 !rounded-full" />
      </div>
      <SkeletonBlock className="w-[220px] h-[220px] !rounded-full" />
      <div className="flex gap-6">
        <SkeletonBlock className="w-24 h-24 !rounded-full" />
        <SkeletonBlock className="w-24 h-24 !rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 w-full">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

function ConnectScreen({ authUrl }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <span className="text-label uppercase text-muted">Pulse</span>
      <a
        href={authUrl || '/api/auth'}
        className="px-6 py-3 rounded-full bg-recoveryGreen text-black text-label font-bold uppercase tracking-wide"
      >
        Connect Google
      </a>
    </div>
  );
}

function StaleBanner() {
  return (
    <div className="w-full bg-surface text-center py-2 border-b border-black/60">
      <span className="text-label uppercase text-recoveryYellow">Showing cached data</span>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('today');

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsAuth = data?.needsAuth || error?.status === 401;

  return (
    <div className="min-h-screen bg-black text-text font-sans">
      {loading && <Skeleton />}
      {!loading && needsAuth && <ConnectScreen authUrl={data?.authUrl ?? error?.authUrl} />}
      {!loading && !needsAuth && data && (
        <>
          {data.stale && <StaleBanner />}
          {tab === 'today' && <Today data={data} onRefresh={() => load({ refresh: true })} refreshing={refreshing} />}
          {tab === 'sleep' && <Sleep data={data} />}
          {tab === 'trends' && <Trends data={data} />}
          <TabBar active={tab} onChange={setTab} />
        </>
      )}
      {!loading && !needsAuth && !data && error && (
        <div className="min-h-screen flex items-center justify-center px-6">
          <p className="text-label uppercase text-recoveryRed text-center">Failed to load Pulse data.</p>
        </div>
      )}
    </div>
  );
}
