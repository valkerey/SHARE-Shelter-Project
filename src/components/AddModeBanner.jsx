import { useEffect, useRef, useState } from 'react';
import { geocode } from '../services/geocoder';
import './AddModeBanner.css';

const DEBOUNCE_MS = 400;
const MIN_QUERY = 3;

export default function AddModeBanner({ onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(async () => {
      if (q.length < MIN_QUERY) {
        setResults([]);
        setError(false);
        setLoading(false);
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(false);
      try {
        const found = await geocode(q, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResults(found);
        setHighlight(0);
      } catch (err) {
        if (err.name !== 'AbortError') setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function pick(result) {
    if (!result) return;
    onPick({ lat: result.lat, lng: result.lng });
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  }

  const showResults = query.trim().length >= MIN_QUERY && !loading;
  const noMatches = showResults && results.length === 0 && !error;

  return (
    <div className="add-mode-banner glass-panel" role="region" aria-label="Drop a pin">
      <div className="add-mode-banner__prompt">
        <span className="add-mode-banner__pin" aria-hidden="true">📍</span>
        <div>
          <div className="add-mode-banner__title">Click anywhere on the map to drop a pin</div>
          <div className="add-mode-banner__sub">or search for an address</div>
        </div>
      </div>

      <input
        type="text"
        className="add-mode-banner__input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 123 Main St, Seattle"
        autoComplete="off"
        aria-label="Search address"
      />

      {loading && (
        <div className="add-mode-banner__hint">Searching…</div>
      )}
      {error && (
        <div className="add-mode-banner__hint">Could not search right now. You can still click the map.</div>
      )}
      {noMatches && (
        <div className="add-mode-banner__hint">No matches in Seattle. Try a more specific address.</div>
      )}
      {showResults && results.length > 0 && (
        <ul className="add-mode-banner__results" role="listbox">
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lng}`}
              className={`add-mode-banner__result ${i === highlight ? 'is-active' : ''}`}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(r)}
            >
              {r.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
