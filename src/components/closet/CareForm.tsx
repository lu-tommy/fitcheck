'use client';

import { Sparkle } from 'lucide-react';

import {
  BLEACH_LABEL,
  BLEACH_RULES,
  CARE_FLAGS,
  CYCLES,
  CYCLE_LABEL,
  DRY_LABEL,
  DRY_METHODS,
  FLAG_LABEL,
  IRON_LABEL,
  IRON_SETTINGS,
  WASH_LABEL,
  WASH_METHODS,
} from '@/domain/care';
import type { CareInstructions } from '@/types';

import { Chip } from '@/components/ui/Chip';
import { Field, Select, Textarea } from '@/components/ui/Field';

export const EMPTY_CARE: CareInstructions = { flags: [], source: 'manual' };

/**
 * The care label, transcribed.
 *
 * Every field is optional and starts empty, because a half-filled label is
 * still useful and an interrogation is not. When the material implies an
 * answer the fields arrive pre-filled and say so, so a guess never looks like
 * something read off the garment.
 */
export function CareForm({
  care,
  onChange,
  suggested,
}: {
  care: CareInstructions;
  onChange: (next: CareInstructions) => void;
  /** True when these values came from the material rather than the label. */
  suggested?: boolean;
}) {
  const set = (patch: Partial<CareInstructions>) =>
    onChange({ ...care, ...patch, source: 'manual' });

  const toggleFlag = (flag: (typeof CARE_FLAGS)[number]) =>
    set({
      flags: care.flags.includes(flag)
        ? care.flags.filter((entry) => entry !== flag)
        : [...care.flags, flag],
    });

  return (
    <div className="space-y-5">
      {suggested ? (
        <p className="flex items-start gap-2 rounded-2xl bg-[var(--info-soft)] p-3 text-[0.8125rem] leading-relaxed text-[var(--info)]">
          <Sparkle size={15} className="mt-0.5 shrink-0" />
          Filled in from the material as a starting point. Check it against the actual label —
          anything you change is kept as yours.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Wash">
          <Select
            value={care.wash ?? ''}
            onChange={(event) =>
              set({ wash: (event.target.value || undefined) as CareInstructions['wash'] })
            }
          >
            <option value="">Not set</option>
            {WASH_METHODS.map((method) => (
              <option key={method} value={method}>
                {WASH_LABEL[method]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cycle">
          <Select
            value={care.cycle ?? ''}
            onChange={(event) =>
              set({ cycle: (event.target.value || undefined) as CareInstructions['cycle'] })
            }
          >
            <option value="">Not set</option>
            {CYCLES.map((cycle) => (
              <option key={cycle} value={cycle}>
                {CYCLE_LABEL[cycle]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dry">
          <Select
            value={care.dry ?? ''}
            onChange={(event) =>
              set({ dry: (event.target.value || undefined) as CareInstructions['dry'] })
            }
          >
            <option value="">Not set</option>
            {DRY_METHODS.map((method) => (
              <option key={method} value={method}>
                {DRY_LABEL[method]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Iron">
          <Select
            value={care.iron ?? ''}
            onChange={(event) =>
              set({ iron: (event.target.value || undefined) as CareInstructions['iron'] })
            }
          >
            <option value="">Not set</option>
            {IRON_SETTINGS.map((setting) => (
              <option key={setting} value={setting}>
                {IRON_LABEL[setting]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Bleach">
        <Select
          value={care.bleach ?? ''}
          onChange={(event) =>
            set({ bleach: (event.target.value || undefined) as CareInstructions['bleach'] })
          }
        >
          <option value="">Not set</option>
          {BLEACH_RULES.map((rule) => (
            <option key={rule} value={rule}>
              {BLEACH_LABEL[rule]}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <span className="text-label mb-2 block text-[var(--text-muted)]">
          Things that would ruin it
        </span>
        <div className="flex flex-wrap gap-2">
          {CARE_FLAGS.map((flag) => (
            <Chip
              key={flag}
              selected={care.flags.includes(flag)}
              onClick={() => toggleFlag(flag)}
            >
              {FLAG_LABEL[flag]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-faint)]">
          These change how the laundry screen groups your wash.
        </p>
      </div>

      <Field label="Anything else on the label">
        <Textarea
          rows={2}
          value={care.notes ?? ''}
          onChange={(event) => set({ notes: event.target.value })}
          placeholder="Do not dry clean. Warm iron on the reverse only."
        />
      </Field>
    </div>
  );
}
