export const getColorGradeStyle = (grade) => {
    if (!grade || grade.style === 'none') {
        return {};
    }
    if (grade.style === 'cinematic') {
        return {
            filter: `contrast(${1 + grade.intensity * 0.15}) saturate(${1 - grade.intensity * 0.1}) brightness(${1 - grade.intensity * 0.05})`
        };
    }
    if (grade.style === 'glow') {
        return {
            filter: `saturate(${1 + grade.intensity * 0.35}) brightness(${1 + grade.intensity * 0.15})`,
            mixBlendMode: 'screen'
        };
    }
    return {};
};
