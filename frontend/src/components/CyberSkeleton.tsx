import { motion } from 'framer-motion'

interface CyberSkeletonProps {
    className?: string
    width?: string | number
    height?: string | number
    variant?: 'text' | 'rectangular' | 'circular'
}

export function CyberSkeleton({
    className = '',
    width,
    height,
    variant = 'rectangular'
}: CyberSkeletonProps) {
    const isCircular = variant === 'circular'

    return (
        <div
            className={`relative overflow-hidden bg-[#0d0d14] border border-white/5 ${className}`}
            style={{
                width: width ?? '100%',
                height: height ?? (variant === 'text' ? '1em' : '100%'),
                borderRadius: isCircular ? '50%' : '4px'
            }}
        >
            {/* Scanning line animation */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f0ff]/10 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear"
                }}
            />

            {/* Glitch overlay */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)',
                    backgroundSize: '4px 4px',
                    backgroundPosition: '0 0, 2px 2px'
                }}
            />
        </div>
    )
}
