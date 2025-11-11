import { useCallback, useEffect, useRef, useState } from 'react';

import { ProgressStep } from '../types/VideoGeneration';

export const DEFAULT_PROGRESS_STEPS: ProgressStep[] = [
    { key: 'cost_estimation', label: 'Budget validé', status: 'completed' },
    { key: 'broll_selection', label: 'B-roll & assets', status: 'pending' },
    { key: 'timeline_generation', label: 'Timeline immersive', status: 'pending' },
    { key: 'audio_mix', label: 'Mix audio premium', status: 'pending' },
    { key: 'video_mux', label: 'Master vidéo', status: 'pending' },
];

const SIMULATION_INTERVAL_MS = 1600;

export const useVideoGenerationProgress = () => {
    const [steps, setSteps] = useState<ProgressStep[]>(DEFAULT_PROGRESS_STEPS);
    const simulationIndex = useRef(0);
    const simulationTimer = useRef<NodeJS.Timeout | null>(null);

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
            simulationIndex.current = Math.min(simulationIndex.current + 1, DEFAULT_PROGRESS_STEPS.length - 1);
            updateStatuses(simulationIndex.current);

            if (simulationIndex.current >= DEFAULT_PROGRESS_STEPS.length - 1) {
                clearSimulation();
            }
        }, SIMULATION_INTERVAL_MS);
    }, [clearSimulation, updateStatuses]);

    const reset = useCallback(() => {
        clearSimulation();
        simulationIndex.current = 0;
        setSteps(DEFAULT_PROGRESS_STEPS);
    }, [clearSimulation]);

    const applyServerSteps = useCallback(
        (serverSteps?: ProgressStep[] | null) => {
            clearSimulation();
            if (serverSteps && serverSteps.length > 0) {
                setSteps(serverSteps);
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


