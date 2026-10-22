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
  public: {
    Tables: {
      artifacts: {
        Row: {
          artist: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          museum_id: string
          ref: string
          room: string
          sort_order: number
          title: string
          year: string
        }
        Insert: {
          artist?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          museum_id: string
          ref: string
          room?: string
          sort_order?: number
          title: string
          year?: string
        }
        Update: {
          artist?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          museum_id?: string
          ref?: string
          room?: string
          sort_order?: number
          title?: string
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_facts: {
        Row: {
          artwork_id: string
          id: string
          label: string
          sort_order: number
          source_title: string | null
          source_url: string | null
        }
        Insert: {
          artwork_id: string
          id?: string
          label: string
          sort_order?: number
          source_title?: string | null
          source_url?: string | null
        }
        Update: {
          artwork_id?: string
          id?: string
          label?: string
          sort_order?: number
          source_title?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_facts_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_guides: {
        Row: {
          artwork_id: string
          audio_path: string | null
          created_at: string
          id: string
          language: string
          script_text: string
        }
        Insert: {
          artwork_id: string
          audio_path?: string | null
          created_at?: string
          id?: string
          language: string
          script_text: string
        }
        Update: {
          artwork_id?: string
          audio_path?: string | null
          created_at?: string
          id?: string
          language?: string
          script_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "artwork_guides_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_packs: {
        Row: {
          created_at: string
          id: string
          language: string
          manifest: Json
          museum_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          language: string
          manifest?: Json
          museum_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          manifest?: Json
          museum_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_packs_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
      museums: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          image_url: string | null
          intro: string
          is_partner: boolean
          languages: string[]
          lat: number | null
          lng: number | null
          name: string
          owner_id: string
          ref_label: string
          slug: string
          source_language: string
        }
        Insert: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          image_url?: string | null
          intro?: string
          is_partner?: boolean
          languages?: string[]
          lat?: number | null
          lng?: number | null
          name: string
          owner_id: string
          ref_label?: string
          slug: string
          source_language?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          image_url?: string | null
          intro?: string
          is_partner?: boolean
          languages?: string[]
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string
          ref_label?: string
          slug?: string
          source_language?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          preferred_language: string
        }
        Insert: {
          created_at?: string
          id: string
          preferred_language?: string
        }
        Update: {
          created_at?: string
          id?: string
          preferred_language?: string
        }
        Relationships: []
      }
      stop_audio: {
        Row: {
          audio_url: string
          body: string
          id: string
          language: string
          museum_id: string
          stop_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audio_url: string
          body: string
          id?: string
          language: string
          museum_id: string
          stop_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string
          body?: string
          id?: string
          language?: string
          museum_id?: string
          stop_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stop_audio_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stop_audio_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          body: string
          created_at: string
          id: string
          museum_id: string
          number: number
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          museum_id: string
          number: number
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          museum_id?: string
          number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_events: {
        Row: {
          artwork_id: string | null
          created_at: string
          event_type: string
          id: string
          museum_id: string | null
          visitor_id: string | null
        }
        Insert: {
          artwork_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          museum_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          artwork_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          museum_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_events_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_events_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      lookup_artifact: {
        Args: { _ref: string; _slug: string }
        Returns: {
          artifact_ref: string
          museum_slug: string
        }[]
      }
      nearby_museums: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          city: string
          distance_km: number
          id: string
          image_url: string
          is_partner: boolean
          name: string
          slug: string
        }[]
      }
      owns_museum: { Args: { _museum_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
