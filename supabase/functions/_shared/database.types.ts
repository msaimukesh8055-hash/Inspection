// supabase/functions/_shared/database.types.ts
// Generated from the hosted schema. Regenerate with: npm run db:types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent: string
          assessment_id: string | null
          cost_usd: number
          created_at: string
          id: string
          latency_ms: number
          model: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          agent: string
          assessment_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number
          model: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          agent?: string
          assessment_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number
          model?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          collect_extra_inr: number | null
          created_at: string
          deducted_inr: number | null
          id: string
          path: string | null
          photo_quality_ok: boolean | null
          refund_inr: number | null
          rental_id: string
          rider_message: string | null
          route_reasons: string[]
          status: string
          total_inr: number
          updated_at: string
        }
        Insert: {
          collect_extra_inr?: number | null
          created_at?: string
          deducted_inr?: number | null
          id?: string
          path?: string | null
          photo_quality_ok?: boolean | null
          refund_inr?: number | null
          rental_id: string
          rider_message?: string | null
          route_reasons?: string[]
          status?: string
          total_inr?: number
          updated_at?: string
        }
        Update: {
          collect_extra_inr?: number | null
          created_at?: string
          deducted_inr?: number | null
          id?: string
          path?: string | null
          photo_quality_ok?: boolean | null
          refund_inr?: number | null
          rental_id?: string
          rider_message?: string | null
          route_reasons?: string[]
          status?: string
          total_inr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: true
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      damage_items: {
        Row: {
          assessment_id: string
          confidence: number
          created_at: string
          id: string
          panel: string
          photo_ref: string
          severity: number
          type: string
        }
        Insert: {
          assessment_id: string
          confidence: number
          created_at?: string
          id?: string
          panel: string
          photo_ref: string
          severity: number
          type: string
        }
        Update: {
          assessment_id?: string
          confidence?: number
          created_at?: string
          id?: string
          panel?: string
          photo_ref?: string
          severity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_orders: {
        Row: {
          assessment_id: string
          created_at: string
          final_total_inr: number | null
          held_inr: number
          id: string
          inspector_id: string | null
          inspector_notes: string | null
          priority: string
          provisional_total_inr: number
          route_reasons: string[]
          staff_note: string | null
          status: string
          summary: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          final_total_inr?: number | null
          held_inr: number
          id?: string
          inspector_id?: string | null
          inspector_notes?: string | null
          priority?: string
          provisional_total_inr: number
          route_reasons?: string[]
          staff_note?: string | null
          status?: string
          summary: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          final_total_inr?: number | null
          held_inr?: number
          id?: string
          inspector_id?: string | null
          inspector_notes?: string | null
          priority?: string
          provisional_total_inr?: number
          route_reasons?: string[]
          staff_note?: string | null
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_orders_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          angle: string | null
          assessment_id: string
          created_at: string
          damage_item_id: string | null
          final_inr: number | null
          id: string
          labour_inr: number
          part_code: string
          parts_inr: number
          reasoning: string | null
          source: string
          total_inr: number
        }
        Insert: {
          angle?: string | null
          assessment_id: string
          created_at?: string
          damage_item_id?: string | null
          final_inr?: number | null
          id?: string
          labour_inr: number
          part_code: string
          parts_inr: number
          reasoning?: string | null
          source: string
          total_inr: number
        }
        Update: {
          angle?: string | null
          assessment_id?: string
          created_at?: string
          damage_item_id?: string | null
          final_inr?: number | null
          id?: string
          labour_inr?: number
          part_code?: string
          parts_inr?: number
          reasoning?: string | null
          source?: string
          total_inr?: number
        }
        Relationships: [
          {
            foreignKeyName: "line_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_damage_item_id_fkey"
            columns: ["damage_item_id"]
            isOneToOne: false
            referencedRelation: "damage_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_part_code_fkey"
            columns: ["part_code"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["part_code"]
          },
        ]
      }
      notifications: {
        Row: {
          assessment_id: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          recipient_role: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          recipient_role: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          recipient_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      overrides: {
        Row: {
          actor: string
          assessment_id: string
          at: string
          from_path: string
          id: string
          reason: string
          to_path: string
        }
        Insert: {
          actor: string
          assessment_id: string
          at?: string
          from_path: string
          id?: string
          reason: string
          to_path: string
        }
        Update: {
          actor?: string
          assessment_id?: string
          at?: string
          from_path?: string
          id?: string
          reason?: string
          to_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "overrides_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_catalog: {
        Row: {
          created_at: string
          description: string
          labour_inr: number
          part_code: string
          parts_inr: number
          vehicle_model: string
        }
        Insert: {
          created_at?: string
          description: string
          labour_inr: number
          part_code: string
          parts_inr: number
          vehicle_model: string
        }
        Update: {
          created_at?: string
          description?: string
          labour_inr?: number
          part_code?: string
          parts_inr?: number
          vehicle_model?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          angle: string
          created_at: string
          id: string
          rental_id: string
          stage: string
          storage_path: string
        }
        Insert: {
          angle: string
          created_at?: string
          id?: string
          rental_id: string
          stage: string
          storage_path: string
        }
        Update: {
          angle?: string
          created_at?: string
          id?: string
          rental_id?: string
          stage?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      reassessments: {
        Row: {
          ai_result: Json
          id: string
          note: string | null
          reason: string
          rental_id: string
          requested_at: string
          resolved_at: string | null
        }
        Insert: {
          ai_result: Json
          id?: string
          note?: string | null
          reason: string
          rental_id: string
          requested_at?: string
          resolved_at?: string | null
        }
        Update: {
          ai_result?: Json
          id?: string
          note?: string | null
          reason?: string
          rental_id?: string
          requested_at?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reassessments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          branch: string | null
          created_at: string
          deposit_inr: number
          id: string
          picked_up_at: string
          returned_at: string | null
          rider_id: string
          status: string
          vehicle_id: string
        }
        Insert: {
          branch?: string | null
          created_at?: string
          deposit_inr?: number
          id?: string
          picked_up_at?: string
          returned_at?: string | null
          rider_id: string
          status?: string
          vehicle_id: string
        }
        Update: {
          branch?: string | null
          created_at?: string
          deposit_inr?: number
          id?: string
          picked_up_at?: string
          returned_at?: string | null
          rider_id?: string
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      status_events: {
        Row: {
          assessment_id: string
          at: string
          id: string
          status: string
        }
        Insert: {
          assessment_id: string
          at?: string
          id?: string
          status: string
        }
        Update: {
          assessment_id?: string
          at?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_events_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          colour: string
          created_at: string
          id: string
          model: string
          reg_no: string
        }
        Insert: {
          colour: string
          created_at?: string
          id?: string
          model: string
          reg_no: string
        }
        Update: {
          colour?: string
          created_at?: string
          id?: string
          model?: string
          reg_no?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_eval_rental: { Args: { p_rental_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
