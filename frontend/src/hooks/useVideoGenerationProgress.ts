import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProgressStep } from '@/types/video';

export const DEFAULT_PROGRESS_STEPS: ProgressStep[] = [
    { key: 'cost_estimation', label: 'Cost validated', status: 'completed' },
    { key: 'broll_selection', label: 'B-roll & assets', status: 'pending' },
    { key: 'timeline_generation', label: 'Immersive timeline', status: 'pending' },
    { key: 'audio_mix', label: 'Audio mix', status: 'pending' },
    { key: 'video_mux', label: 'Video master', status: 'pending' },
];

const SIMULATION_INTERVAL_MS = 1_600;

const mapStepStatus = (value: string): ProgressStep['status'] => {
    if (value === 'completed' || value === 'pending' || value === 'running') {
        return value;
    }
    return 'pending';
};

export const useVideoGenerationProgress = (initialSteps?: ProgressStep[]) => {
    const baseSteps = useMemo<ProgressStep[]>(
        () => (initialSteps && initialSteps.length > 0 ? initialSteps : DEFAULT_PROGRESS_STEPS),
        [initialSteps],
    );

    const baseStepsRef = useRef<ProgressStep[]>(baseSteps);
    const [steps, setSteps] = useState<ProgressStep[]>(baseStepsRef.current);
    const simulationIndex = useRef(0);
    const simulationTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        baseStepsRef.current = baseSteps;
        setSteps(baseSteps);
        simulationIndex.current = 0;
    }, [baseSteps]);

    const clearSimulation = useCallback(() => {
        if (simulationTimer.current) {
            clearInterval(simulationTimer.current);
            simulationTimer.current = null;
        }
    }, []);

    const updateStatuses = useCallback((activeIndex: number) => {
        setSteps((prev) =>
            prev.map((step, index) => {
                if (index < activeIndex) {
                    return { ...step, status: 'completed' };
                }
                if (index === activeIndex) {
                    return { ...step, status: 'running' };
                }
                return { ...step, status: 'pending' };
            }),
        );
    }, []);

    const startSimulation = useCallback(() => {
        clearSimulation();
        simulationIndex.current = 0;
        updateStatuses(simulationIndex.current);

        simulationTimer.current = setInterval(() => {
            const lastIndex = Math.max(baseStepsRef.current.length - 1, 0);
            simulationIndex.current = Math.min(simulationIndex.current + 1, lastIndex);
            updateStatuses(simulationIndex.current);

            if (simulationIndex.current >= lastIndex) {
                clearSimulation();
            }
        }, SIMULATION_INTERVAL_MS);
    }, [clearSimulation, updateStatuses]);

    const reset = useCallback(() => {
        clearSimulation();
        simulationIndex.current = 0;
        setSteps(baseStepsRef.current);
    }, [clearSimulation]);

    const applyServerSteps = useCallback(
        (serverSteps?: ProgressStep[] | null) => {
            clearSimulation();
            if (serverSteps && serverSteps.length > 0) {
                setSteps(
                    serverSteps.map((step) => ({
                        key: step.key,
                        label: step.label,
                        status: mapStepStatus(step.status),
                        detail: step.detail,
                    })),
                );
            } else {
                setSteps((prev) => prev.map((step) => ({ ...step, status: 'completed' })));
            }
        },
        [clearSimulation],
    );

    const fail = useCallback(() => {
        clearSimulation();
        setSteps((prev) =>
            prev.map((step) => {
                if (step.status === 'running') {
                    return { ...step, status: 'pending' };
                }
                return step;
            }),
        );
    }, [clearSimulation]);

    useEffect(() => {
        return () => {
            clearSimulation();
        };
    }, [clearSimulation]);

    return {
        steps,
        startSimulation,
        applyServerSteps,
        reset,
        fail,
    };
};

