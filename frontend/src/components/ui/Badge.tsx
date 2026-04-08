import { clsx } from 'clsx'

type Variant = 'brand' | 'emerald' | 'amber' | 'purple' | 'gray' | 'orange' | 'green'

const variantStyles: Record<Variant, string> = {
  brand: 'bg-brand-100 text-brand-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-green-100 text-green-700',
}

interface BadgeProps {
  label: string
  variant?: Variant
  className?: string
}

export function Badge({ label, variant = 'gray', className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold',
      variantStyles[variant],
      className
    )}>
      {label}
    </span>
  )
}

export function teamBadgeVariant(teamShort: string): Variant {
  if (teamShort === 'Flutter') return 'brand'
  if (teamShort === 'KMP') return 'emerald'
  if (teamShort === 'Producer') return 'amber'
  if (teamShort === 'Manager') return 'purple'
  return 'gray'
}
