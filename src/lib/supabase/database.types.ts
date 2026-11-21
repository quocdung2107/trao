
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "consents": {
                  Row: {
                    "consented_at": string,"event_id": string,"guest_id": string,"id": string,"policy_version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consented_at"?: string,"event_id": string,"guest_id": string,"id"?: string,"policy_version": string
                  }
                  Update: {
                    "consented_at"?: string,"event_id"?: string,"guest_id"?: string,"id"?: string,"policy_version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_guest_id_event_id_fkey"
      columns: ["guest_id","event_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["id","event_id"]
    }
                  ]
                },"event_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string,"event_id": string,"expires_at": string,"id": string,"note": string | null,"revoked_at": string | null,"role": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string,"event_id": string,"expires_at"?: string,"id"?: string,"note"?: string | null,"revoked_at"?: string | null,"role": string,"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string,"event_id"?: string,"expires_at"?: string,"id"?: string,"note"?: string | null,"revoked_at"?: string | null,"role"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_invites_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_members": {
                  Row: {
                    "created_at": string,"event_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_members_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string,"deleted_at": string | null,"event_type": string,"id": string,"settings": NonNullable<Json>,"status": string,"timezone": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"event_type"?: string,"id"?: string,"settings"?: NonNullable<Json>,"status"?: string,"timezone"?: string,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"event_type"?: string,"id"?: string,"settings"?: NonNullable<Json>,"status"?: string,"timezone"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"guest_group_links": {
                  Row: {
                    "event_id": string,"group_id": string,"guest_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"group_id": string,"guest_id": string
                  }
                  Update: {
                    "event_id"?: string,"group_id"?: string,"guest_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guest_group_links_group_id_event_id_fkey"
      columns: ["group_id","event_id"]
isOneToOne: false
      referencedRelation: "guest_groups"
      referencedColumns: ["id","event_id"]
    },{
      foreignKeyName: "guest_group_links_guest_id_event_id_fkey"
      columns: ["guest_id","event_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["id","event_id"]
    }
                  ]
                },"guest_groups": {
                  Row: {
                    "color": string | null,"created_at": string,"event_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"event_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"event_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guest_groups_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"guests": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"display_name": string,"email": string | null,"event_id": string,"id": string,"import_job_id": string | null,"invite_sent_at": string | null,"max_party_size": number,"notes": string | null,"phone_e164": string | null,"salutation": string | null,"search_text": string | null,"side": string | null,"source": string,"token": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"display_name": string,"email"?: string | null,"event_id": string,"id"?: string,"import_job_id"?: string | null,"invite_sent_at"?: string | null,"max_party_size"?: number,"notes"?: string | null,"phone_e164"?: string | null,"salutation"?: string | null,"search_text"?: never,"side"?: string | null,"source"?: string,"token"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"display_name"?: string,"email"?: string | null,"event_id"?: string,"id"?: string,"import_job_id"?: string | null,"invite_sent_at"?: string | null,"max_party_size"?: number,"notes"?: string | null,"phone_e164"?: string | null,"salutation"?: string | null,"search_text"?: never,"side"?: string | null,"source"?: string,"token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guests_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guests_import_job_id_fkey"
      columns: ["import_job_id"]
isOneToOne: false
      referencedRelation: "import_jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"import_jobs": {
                  Row: {
                    "created_at": string,"created_by": string,"created_rows": number,"event_id": string,"file_name": string | null,"id": string,"total_rows": number,"undone_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"created_rows"?: number,"event_id": string,"file_name"?: string | null,"id"?: string,"total_rows"?: number,"undone_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"created_rows"?: number,"event_id"?: string,"file_name"?: string | null,"id"?: string,"total_rows"?: number,"undone_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_jobs_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"created_by": string,"event_id": string,"id": string,"name": string,"published_at": string | null,"session_ids": (string)[] | null,"slug": string,"template_key": string,"template_version": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"event_id": string,"id"?: string,"name"?: string,"published_at"?: string | null,"session_ids"?: (string)[] | null,"slug"?: string,"template_key": string,"template_version"?: number,"updated_at"?: string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string,"event_id"?: string,"id"?: string,"name"?: string,"published_at"?: string | null,"session_ids"?: (string)[] | null,"slug"?: string,"template_key"?: string,"template_version"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_invites": {
                  Row: {
                    "attending_count": number | null,"created_at": string,"event_id": string,"guest_id": string,"id": string,"responded_at": string | null,"responded_via": string | null,"rsvp_note": string | null,"rsvp_status": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attending_count"?: number | null,"created_at"?: string,"event_id": string,"guest_id": string,"id"?: string,"responded_at"?: string | null,"responded_via"?: string | null,"rsvp_note"?: string | null,"rsvp_status"?: string,"session_id": string
                  }
                  Update: {
                    "attending_count"?: number | null,"created_at"?: string,"event_id"?: string,"guest_id"?: string,"id"?: string,"responded_at"?: string | null,"responded_via"?: string | null,"rsvp_note"?: string | null,"rsvp_status"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_invites_guest_id_event_id_fkey"
      columns: ["guest_id","event_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["id","event_id"]
    },{
      foreignKeyName: "session_invites_session_id_event_id_fkey"
      columns: ["session_id","event_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id","event_id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "address": string | null,"checkin_enabled": boolean,"created_at": string,"ends_at": string | null,"event_id": string,"id": string,"map_url": string | null,"name": string,"seating_enabled": boolean,"sort": number,"starts_at": string | null,"venue_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"checkin_enabled"?: boolean,"created_at"?: string,"ends_at"?: string | null,"event_id": string,"id"?: string,"map_url"?: string | null,"name": string,"seating_enabled"?: boolean,"sort"?: number,"starts_at"?: string | null,"venue_name"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"checkin_enabled"?: boolean,"created_at"?: string,"ends_at"?: string | null,"event_id"?: string,"id"?: string,"map_url"?: string | null,"name"?: string,"seating_enabled"?: boolean,"sort"?: number,"starts_at"?: string | null,"venue_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"wishes": {
                  Row: {
                    "author_name": string,"created_at": string,"event_id": string,"guest_id": string | null,"id": string,"invitation_id": string,"message": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_name": string,"created_at"?: string,"event_id": string,"guest_id"?: string | null,"id"?: string,"invitation_id": string,"message": string,"status"?: string
                  }
                  Update: {
                    "author_name"?: string,"created_at"?: string,"event_id"?: string,"guest_id"?: string | null,"id"?: string,"invitation_id"?: string,"message"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishes_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishes_guest_id_fkey"
      columns: ["guest_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishes_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: false
      referencedRelation: "invitations"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_event_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"create_event":
{ Args: { "p_event_type"?: string,"p_first_session_name"?: string,"p_title": string,"p_workspace_id": string }; Returns: string
                           },
"event_stats":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"get_guest_invitation":
{ Args: { "p_slug": string,"p_token": string }; Returns: Json
                           },
"get_invitation":
{ Args: { "p_slug": string }; Returns: Json
                           },
"import_guests":
{ Args: { "p_event_id": string,"p_file_name": string,"p_rows": Json,"p_session_ids"?: (string)[] }; Returns: Json
                           },
"post_wish":
{ Args: { "p_message": string,"p_name": string,"p_slug": string,"p_token"?: string }; Returns: undefined
                           },
"restore_event":
{ Args: { "p_event_id": string }; Returns: undefined
                           },
"submit_rsvp":
{ Args: { "p_consent_version"?: string,"p_note"?: string,"p_responses": Json,"p_slug": string,"p_token": string }; Returns: Json
                           },
"trash_event":
{ Args: { "p_event_id": string }; Returns: undefined
                           },
"undo_import":
{ Args: { "p_job_id": string }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
