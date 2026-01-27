import { useEffect, useState } from "react";

interface CountUpProps {
    value: number;
    duration?: number;
    formatter?: (value: number) => string;
    className?: string;
}

export function CountUp({ value, duration = 1000, formatter, className }: CountUpProps) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const startValue = 0;
        const endValue = value;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);

            const current = Math.floor(startValue + (endValue - startValue) * ease);
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue);
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    const output = formatter ? formatter(displayValue) : displayValue;

    return <span className={className}>{output}</span>;
}
