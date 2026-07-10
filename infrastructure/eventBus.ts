import EventEmmiter from 'events'

export type EventTypesMap = {
  upload_session_ready: { sessionId: string }
}

const eventEmmiter = new EventEmmiter()

export const eventBus = {
  emit: <TEvent extends keyof EventTypesMap> (event: TEvent, payload: EventTypesMap[TEvent]) => {
      eventEmmiter.emit(event, payload)
  },
  on: <TEvent extends keyof EventTypesMap>(
      event: TEvent, 
      callback: (payload: EventTypesMap[TEvent]) => void
  ) => {
      eventEmmiter.on(event, callback)
      return () => eventEmmiter.off(event, callback)
  }
}

