export type EventStatus = 'draft' | 'published' | 'closed' | 'archived'
export type ReservationStatus = 'active' | 'void'

export interface Event {
  id: string
  name: string
  date_time: string
  venue: string
  description: string
  cover_image_url: string | null
  status: EventStatus
  gate_pin: string
  max_per_reservation: number
  created_at: string
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  price: number
  capacity: number
  sold: number
  sort_order: number
}

export interface Reservation {
  id: string
  event_id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  nic: string | null
  status: ReservationStatus
  created_at: string
}

export interface ReservationItem {
  id: string
  reservation_id: string
  ticket_type_id: string
  quantity: number
}

export interface ScanLog {
  id: string
  reservation_id: string
  scanned_at: string
  confirmed: boolean
}

export interface Settings {
  id: number
  notification_email: string
}

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: {
      create_reservation: {
        Args: {
          p_id: string
          p_event_id: string
          p_buyer_name: string
          p_buyer_email: string
          p_buyer_phone: string
          p_buyer_nic: string
          p_items: { ticket_type_id: string; quantity: number }[]
        }
        Returns: string
      }
    }
    Tables: {
      events: {
        Row: Event
        Insert: Omit<Event, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Event, 'id'>>
        Relationships: []
      }
      ticket_types: {
        Row: TicketType
        Insert: Omit<TicketType, 'id' | 'sold'> & { id?: string; sold?: number }
        Update: Partial<Omit<TicketType, 'id'>>
        Relationships: []
      }
      reservations: {
        Row: Reservation
        Insert: Omit<Reservation, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Reservation, 'id'>>
        Relationships: []
      }
      reservation_items: {
        Row: ReservationItem
        Insert: Omit<ReservationItem, 'id'> & { id?: string }
        Update: Partial<Omit<ReservationItem, 'id'>>
        Relationships: []
      }
      scan_logs: {
        Row: ScanLog
        Insert: Omit<ScanLog, 'id' | 'scanned_at'> & { id?: string; scanned_at?: string }
        Update: Partial<Omit<ScanLog, 'id'>>
        Relationships: []
      }
      settings: {
        Row: Settings
        Insert: Settings
        Update: Partial<Settings>
        Relationships: []
      }
    }
    Enums: {
      event_status: EventStatus
      reservation_status: ReservationStatus
    }
  }
}
