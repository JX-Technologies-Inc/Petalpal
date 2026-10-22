import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useFairyRuntime } from '../../../services/fairyRuntime';
import type { FairyHandle } from './GardenFairy';
import { mailboxApproachAnchor } from './mailboxDestination';
import { RETRY_MS, scheduleAction, scheduleRest, wanderPause, wanderTarget } from './fairySchedule';
import { WALK_NETWORK } from './walkNetwork';

const NOWHERE = { x: -1e9, y: -1e9 };

// Drives the Garden Fairy from her server-side day (fairySchedule.ts) once a second. Returns the
// call the Garden makes whenever the user sends her somewhere, which holds the schedule off a minute.
export function useFairySchedule(fairyRef: RefObject<FairyHandle | null>, enabled: boolean) {
  const runtime = useFairyRuntime();
  const rest = enabled && runtime?.gardenSchedule === true ? scheduleRest(runtime.currentState) : null;
  const memory = useRef({ placed: false, userAt: 0, idleSince: 0, pauseMs: wanderPause(Math.random), retryAt: 0, lastState: '' });
  const restRef = useRef(rest); restRef.current = rest;
  useEffect(() => { if (!rest) memory.current.placed = false; }, [rest]);
  useEffect(() => {
    if (!rest) return;
    const tick = () => {
      const fairy = fairyRef.current, current = restRef.current;
      if (!fairy || !current) return;
      const m = memory.current, now = Date.now(), navState = fairy.getState();
      if (navState !== m.lastState) {
        if (navState === 'idle') { m.idleSince = now; m.pauseMs = wanderPause(Math.random); }
        m.lastState = navState;
      }
      const action = scheduleAction({ rest: current, navState, position: fairy.getPosition(), mailboxStand: mailboxApproachAnchor,
        placed: m.placed, now, userAt: m.userAt, idleSince: m.idleSince, pauseMs: m.pauseMs, retryAt: m.retryAt });
      let started: boolean;
      if (action === 'place') {
        started = fairy.place(current, current === 'path' ? wanderTarget(WALK_NETWORK.nodes, NOWHERE, Math.random, [0, Infinity]) ?? undefined : undefined);
        m.placed = started; m.idleSince = now;
      } else if (action === 'leaveTreehouse') started = fairy.returnFromTreehouse();
      else if (action === 'go') {
        started = current === 'tea' ? fairy.visitTea() : current === 'swing' ? fairy.visitSwing() : current === 'moon' ? fairy.visitMoonBed()
          : current === 'treehouse' ? fairy.visitTreehouse() : fairy.move(mailboxApproachAnchor);
      } else if (action === 'wander') {
        // A few path points sit on ground the Garden blocks; try another before waiting.
        started = false;
        for (let attempt = 0; attempt < 5 && !started; attempt++) {
          const target = wanderTarget(WALK_NETWORK.nodes, fairy.getPosition(), Math.random);
          started = !!target && fairy.move(target);
        }
      } else return;
      if (!started) m.retryAt = now + RETRY_MS;
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [rest, fairyRef]);
  return useCallback(() => { memory.current.userAt = Date.now(); }, []);
}
