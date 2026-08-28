'use client';

import { Cloud, CloudFog, CloudRain, CloudSnow, MapPin, Sun, Zap, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { formatTemperature } from '@/lib/format';
import { weatherKind } from '@/lib/weather';
import { cn } from '@/lib/cn';
import { usePreferences } from '@/store/preferences';
import { useWeather } from '@/store/weather';

const ICONS = {
  clear: Sun,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: Zap,
  fog: CloudFog,
} as const;

export function WeatherCard({ className }: { className?: string }) {
  const { snapshot, status, refresh } = useWeather();
  const units = usePreferences((state) => state.preferences.units);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (status === 'denied' && !snapshot) {
    return (
      <button
        type="button"
        onClick={() => void refresh({ force: true })}
        className={cn('card pressable flex w-full items-center gap-3 p-4 text-left', className)}
      >
        <MapPin size={18} className="shrink-0 text-[var(--text-muted)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium">Add your location</span>
          <span className="block text-[0.8125rem] text-[var(--text-muted)]">
            So outfits match the actual forecast.
          </span>
        </span>
      </button>
    );
  }

  if (!snapshot) {
    return <div className={cn('skeleton h-24 rounded-[var(--radius-card)]', className)} />;
  }

  const Icon = ICONS[weatherKind(snapshot.code)];
  const loading = status === 'loading' || status === 'locating';

  return (
    <section className={cn('card flex items-center gap-4 p-4', className)}>
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-title tabular-nums">
            {formatTemperature(snapshot.temperature, units)}
          </span>
          <span className="truncate text-[0.9375rem] text-[var(--text-muted)]">
            {snapshot.condition}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[0.8125rem] text-[var(--text-muted)]">
          {formatTemperature(snapshot.high, units)} / {formatTemperature(snapshot.low, units)}
          {snapshot.precipitationChance > 15
            ? ` · ${snapshot.precipitationChance}% rain`
            : ''} · {snapshot.locationLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void refresh({ force: true })}
        aria-label="Refresh weather"
        className="pressable grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-faint)]"
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : undefined} />
      </button>
    </section>
  );
}
