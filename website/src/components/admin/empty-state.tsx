import type { ReactNode } from 'react'
import { StateView } from '@/components/ui/state-view'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

/**
 * EmptyState — shown when an admin list has zero rows. Thin wrapper over the
 * shared <StateView> primitive so the operator console and the customer
 * portal render empty states identically; only the copy differs per surface.
 */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <StateView
      bordered
      size="panel"
      icon={icon}
      title={title}
      description={description}
      actions={action}
      dataState="empty"
    />
  )
}
