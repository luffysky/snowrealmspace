export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          occurred_at: string
          projected_at: string | null
          properties: Json
          space_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          projected_at?: string | null
          properties?: Json
          space_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          projected_at?: string | null
          properties?: Json
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_actions: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          error: string | null
          id: string
          input: Json
          message_id: string | null
          output: Json | null
          requires_confirmation: boolean
          space_id: string
          status: string
          tool_name: string
          undo_payload: Json | null
          undone_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input: Json
          message_id?: string | null
          output?: Json | null
          requires_confirmation?: boolean
          space_id: string
          status?: string
          tool_name: string
          undo_payload?: Json | null
          undone_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          message_id?: string | null
          output?: Json | null
          requires_confirmation?: boolean
          space_id?: string
          status?: string
          tool_name?: string
          undo_payload?: Json | null
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          blocks: Json
          content: string | null
          context_refs: Json
          created_at: string
          error: string | null
          escalated: boolean
          id: string
          is_free: boolean | null
          latency_ms: number | null
          model_used: string | null
          provider: string | null
          role: string
          space_id: string
          thread_id: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          blocks?: Json
          content?: string | null
          context_refs?: Json
          created_at?: string
          error?: string | null
          escalated?: boolean
          id?: string
          is_free?: boolean | null
          latency_ms?: number | null
          model_used?: string | null
          provider?: string | null
          role: string
          space_id: string
          thread_id: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          blocks?: Json
          content?: string | null
          context_refs?: Json
          created_at?: string
          error?: string | null
          escalated?: boolean
          id?: string
          is_free?: boolean | null
          latency_ms?: number | null
          model_used?: string | null
          provider?: string | null
          role?: string
          space_id?: string
          thread_id?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "agent_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          avatar_asset_id: string | null
          created_at: string
          display_name: string
          greeting_style: string
          persona_key: string
          space_id: string
          updated_at: string
        }
        Insert: {
          avatar_asset_id?: string | null
          created_at?: string
          display_name?: string
          greeting_style?: string
          persona_key?: string
          space_id: string
          updated_at?: string
        }
        Update: {
          avatar_asset_id?: string | null
          created_at?: string
          display_name?: string
          greeting_style?: string
          persona_key?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_avatar_fk"
            columns: ["avatar_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_profiles_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_threads: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          last_message_at: string
          mode: string
          project_id: string | null
          space_id: string
          summary: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          mode?: string
          project_id?: string | null
          space_id: string
          summary?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          mode?: string
          project_id?: string | null
          space_id?: string
          summary?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_threads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_threads_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_daily_quota: {
        Row: {
          free_calls: number
          local_date: string
          paid_calls: number
          space_id: string
          vision_calls: number
        }
        Insert: {
          free_calls?: number
          local_date: string
          paid_calls?: number
          space_id: string
          vision_calls?: number
        }
        Update: {
          free_calls?: number
          local_date?: string
          paid_calls?: number
          space_id?: string
          vision_calls?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_daily_quota_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          context_window: number | null
          cost_input_per_1m: number
          cost_output_per_1m: number
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          is_free: boolean
          metadata: Json
          model_name: string
          notes: string | null
          provider: string
          sort_order: number
          supports_streaming: boolean
          supports_tools: boolean
          supports_vision: boolean
          updated_at: string
        }
        Insert: {
          context_window?: number | null
          cost_input_per_1m?: number
          cost_output_per_1m?: number
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          metadata?: Json
          model_name: string
          notes?: string | null
          provider: string
          sort_order?: number
          supports_streaming?: boolean
          supports_tools?: boolean
          supports_vision?: boolean
          updated_at?: string
        }
        Update: {
          context_window?: number | null
          cost_input_per_1m?: number
          cost_output_per_1m?: number
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_free?: boolean
          metadata?: Json
          model_name?: string
          notes?: string | null
          provider?: string
          sort_order?: number
          supports_streaming?: boolean
          supports_tools?: boolean
          supports_vision?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_provider_keys: {
        Row: {
          api_key_encrypted: string
          budget_reset_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_ok_at: string | null
          monthly_budget_usd: number | null
          provider: string
          updated_at: string
          used_this_month_usd: number
        }
        Insert: {
          api_key_encrypted: string
          budget_reset_at: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_ok_at?: string | null
          monthly_budget_usd?: number | null
          provider: string
          updated_at?: string
          used_this_month_usd?: number
        }
        Update: {
          api_key_encrypted?: string
          budget_reset_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_ok_at?: string | null
          monthly_budget_usd?: number | null
          provider?: string
          updated_at?: string
          used_this_month_usd?: number
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          context_hash: string
          created_at: string
          embedding: string | null
          expires_at: string
          hit_count: number
          id: string
          prompt_hash: string
          response_text: string
          scope: string
          space_id: string | null
          usage_key: string
        }
        Insert: {
          context_hash: string
          created_at?: string
          embedding?: string | null
          expires_at: string
          hit_count?: number
          id?: string
          prompt_hash: string
          response_text: string
          scope?: string
          space_id?: string | null
          usage_key: string
        }
        Update: {
          context_hash?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string
          hit_count?: number
          id?: string
          prompt_hash?: string
          response_text?: string
          scope?: string
          space_id?: string | null
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_response_cache_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          attempts: number
          cache_hit: string | null
          cache_read_tokens: number
          cache_write_tokens: number
          cost_usd: number
          created_at: string
          degraded: boolean
          error: string | null
          escalated: boolean
          fell_back: boolean
          id: string
          is_free: boolean
          latency_ms: number | null
          model: string
          provider: string
          space_id: string | null
          tokens_input: number
          tokens_output: number
          usage_key: string
        }
        Insert: {
          attempts?: number
          cache_hit?: string | null
          cache_read_tokens?: number
          cache_write_tokens?: number
          cost_usd?: number
          created_at?: string
          degraded?: boolean
          error?: string | null
          escalated?: boolean
          fell_back?: boolean
          id?: string
          is_free: boolean
          latency_ms?: number | null
          model: string
          provider: string
          space_id?: string | null
          tokens_input?: number
          tokens_output?: number
          usage_key: string
        }
        Update: {
          attempts?: number
          cache_hit?: string | null
          cache_read_tokens?: number
          cache_write_tokens?: number
          cost_usd?: number
          created_at?: string
          degraded?: boolean
          error?: string | null
          escalated?: boolean
          fell_back?: boolean
          id?: string
          is_free?: boolean
          latency_ms?: number | null
          model?: string
          provider?: string
          space_id?: string | null
          tokens_input?: number
          tokens_output?: number
          usage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_models: {
        Row: {
          candidates: Json
          enabled: boolean
          model_name: string
          updated_at: string
          updated_by: string | null
          usage_key: string
        }
        Insert: {
          candidates?: Json
          enabled?: boolean
          model_name: string
          updated_at?: string
          updated_by?: string | null
          usage_key: string
        }
        Update: {
          candidates?: Json
          enabled?: boolean
          model_name?: string
          updated_at?: string
          updated_by?: string | null
          usage_key?: string
        }
        Relationships: []
      }
      asset_renditions: {
        Row: {
          asset_id: string
          bytes: number
          created_at: string
          height: number | null
          id: string
          mime_type: string
          role: string
          space_id: string
          storage_key: string
          width: number | null
        }
        Insert: {
          asset_id: string
          bytes: number
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          role: string
          space_id: string
          storage_key: string
          width?: number | null
        }
        Update: {
          asset_id?: string
          bytes?: number
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          role?: string
          space_id?: string
          storage_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_renditions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_renditions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          archived_at: string | null
          bytes: number
          checksum: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_ms: number | null
          failure_reason: string | null
          height: number | null
          id: string
          is_favorite: boolean
          kind: string
          local_features: Json
          mime_type: string
          original_filename: string | null
          space_id: string
          status: string
          storage_key: string
          tags: string[]
          updated_at: string
          width: number | null
        }
        Insert: {
          archived_at?: string | null
          bytes: number
          checksum: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          failure_reason?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean
          kind: string
          local_features?: Json
          mime_type: string
          original_filename?: string | null
          space_id: string
          status?: string
          storage_key: string
          tags?: string[]
          updated_at?: string
          width?: number | null
        }
        Update: {
          archived_at?: string | null
          bytes?: number
          checksum?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_ms?: number | null
          failure_reason?: string | null
          height?: number | null
          id?: string
          is_favorite?: boolean
          kind?: string
          local_features?: Json
          mime_type?: string
          original_filename?: string | null
          space_id?: string
          status?: string
          storage_key?: string
          tags?: string[]
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_hash: string | null
          space_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_hash?: string | null
          space_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_hash?: string | null
          space_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      background_items: {
        Row: {
          asset_id: string | null
          blur: number
          brightness: number
          contrast: number
          created_at: string
          created_by: string | null
          crop_h: number
          crop_w: number
          crop_x: number
          crop_y: number
          deleted_at: string | null
          fit: string
          glass_blur: number
          glass_color: string
          glass_enabled: boolean
          glass_opacity: number
          glass_radius: number
          gradient_spec: Json | null
          id: string
          loop: boolean
          muted: boolean
          name: string | null
          overlay_color: string
          overlay_opacity: number
          position_x: number
          position_y: number
          procedural_id: string | null
          saturation: number
          space_id: string
          type: string
          updated_at: string
          zoom: number
        }
        Insert: {
          asset_id?: string | null
          blur?: number
          brightness?: number
          contrast?: number
          created_at?: string
          created_by?: string | null
          crop_h?: number
          crop_w?: number
          crop_x?: number
          crop_y?: number
          deleted_at?: string | null
          fit?: string
          glass_blur?: number
          glass_color?: string
          glass_enabled?: boolean
          glass_opacity?: number
          glass_radius?: number
          gradient_spec?: Json | null
          id?: string
          loop?: boolean
          muted?: boolean
          name?: string | null
          overlay_color?: string
          overlay_opacity?: number
          position_x?: number
          position_y?: number
          procedural_id?: string | null
          saturation?: number
          space_id: string
          type: string
          updated_at?: string
          zoom?: number
        }
        Update: {
          asset_id?: string | null
          blur?: number
          brightness?: number
          contrast?: number
          created_at?: string
          created_by?: string | null
          crop_h?: number
          crop_w?: number
          crop_x?: number
          crop_y?: number
          deleted_at?: string | null
          fit?: string
          glass_blur?: number
          glass_color?: string
          glass_enabled?: boolean
          glass_opacity?: number
          glass_radius?: number
          gradient_spec?: Json | null
          id?: string
          loop?: boolean
          muted?: boolean
          name?: string | null
          overlay_color?: string
          overlay_opacity?: number
          position_x?: number
          position_y?: number
          procedural_id?: string | null
          saturation?: number
          space_id?: string
          type?: string
          updated_at?: string
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "background_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      background_playlist_items: {
        Row: {
          background_item_id: string
          created_at: string
          id: string
          playlist_id: string
          position: number
          space_id: string
        }
        Insert: {
          background_item_id: string
          created_at?: string
          id?: string
          playlist_id: string
          position: number
          space_id: string
        }
        Update: {
          background_item_id?: string
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_playlist_items_background_item_id_fkey"
            columns: ["background_item_id"]
            isOneToOne: false
            referencedRelation: "background_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "background_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_playlist_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      background_playlists: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          interval_seconds: number
          is_active: boolean
          name: string
          play_mode: string
          schedule: Json
          space_id: string
          transition: string
          transition_ms: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          interval_seconds?: number
          is_active?: boolean
          name: string
          play_mode?: string
          schedule?: Json
          space_id: string
          transition?: string
          transition_ms?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          interval_seconds?: number
          is_active?: boolean
          name?: string
          play_mode?: string
          schedule?: Json
          space_id?: string
          transition?: string
          transition_ms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_playlists_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          available_from: string | null
          chain_index: number | null
          content_id: string
          cooldown_days: number | null
          created_at: string
          enabled: boolean
          estimated_minutes: number | null
          greeting_slot: string | null
          kind: string
          label: string | null
          min_days_since_signup: number | null
          rarity: string | null
          requires_background_changed: boolean
          requires_tag: string | null
          tags: string[]
          text: string
          weight: number
        }
        Insert: {
          available_from?: string | null
          chain_index?: number | null
          content_id: string
          cooldown_days?: number | null
          created_at?: string
          enabled?: boolean
          estimated_minutes?: number | null
          greeting_slot?: string | null
          kind: string
          label?: string | null
          min_days_since_signup?: number | null
          rarity?: string | null
          requires_background_changed?: boolean
          requires_tag?: string | null
          tags?: string[]
          text: string
          weight?: number
        }
        Update: {
          available_from?: string | null
          chain_index?: number | null
          content_id?: string
          cooldown_days?: number | null
          created_at?: string
          enabled?: boolean
          estimated_minutes?: number | null
          greeting_slot?: string | null
          kind?: string
          label?: string | null
          min_days_since_signup?: number | null
          rarity?: string | null
          requires_background_changed?: boolean
          requires_tag?: string | null
          tags?: string[]
          text?: string
          weight?: number
        }
        Relationships: []
      }
      daily_items: {
        Row: {
          archived_at: string | null
          body: string
          content_hash: string
          created_at: string
          delivered_at: string | null
          id: string
          kind: string
          local_date: string
          payload: Json
          source: string
          source_ref: string | null
          space_id: string
          status: string
          title: string | null
        }
        Insert: {
          archived_at?: string | null
          body: string
          content_hash: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind: string
          local_date: string
          payload?: Json
          source: string
          source_ref?: string | null
          space_id: string
          status?: string
          title?: string | null
        }
        Update: {
          archived_at?: string | null
          body?: string
          content_hash?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          kind?: string
          local_date?: string
          payload?: Json
          source?: string
          source_ref?: string | null
          space_id?: string
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          expires_at: string | null
          external_account_id: string | null
          external_account_label: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: string
          refresh_token_encrypted: string | null
          scopes: string[]
          space_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          external_account_id?: string | null
          external_account_label?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: string
          refresh_token_encrypted?: string | null
          scopes?: string[]
          space_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          external_account_id?: string | null
          external_account_label?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          scopes?: string[]
          space_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_connections_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_files: {
        Row: {
          connection_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          external_id: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          project_id: string | null
          provider: string
          source_url: string | null
          space_id: string
          sync_status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          project_id?: string | null
          provider?: string
          source_url?: string | null
          space_id: string
          sync_status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          project_id?: string | null
          provider?: string
          source_url?: string | null
          space_id?: string
          sync_status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_files_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "design_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_files_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_insights: {
        Row: {
          created_at: string
          id: string
          kind: string
          model_used: string | null
          snapshot_id: string | null
          space_id: string
          statements: Json
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          model_used?: string | null
          snapshot_id?: string | null
          space_id: string
          statements?: Json
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          model_used?: string | null
          snapshot_id?: string | null
          space_id?: string
          statements?: Json
        }
        Relationships: [
          {
            foreignKeyName: "design_insights_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "design_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_insights_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_principles: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          position: number
          space_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          position?: number
          space_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          position?: number
          space_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_principles_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_snapshots: {
        Row: {
          asset_id: string
          checksum: string
          created_at: string
          design_file_id: string
          document_asset_id: string | null
          external_version_id: string | null
          extracted_features: Json
          id: string
          space_id: string
          vision_features: Json
        }
        Insert: {
          asset_id: string
          checksum: string
          created_at?: string
          design_file_id: string
          document_asset_id?: string | null
          external_version_id?: string | null
          extracted_features?: Json
          id?: string
          space_id: string
          vision_features?: Json
        }
        Update: {
          asset_id?: string
          checksum?: string
          created_at?: string
          design_file_id?: string
          document_asset_id?: string | null
          external_version_id?: string | null
          extracted_features?: Json
          id?: string
          space_id?: string
          vision_features?: Json
        }
        Relationships: [
          {
            foreignKeyName: "design_snapshots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_snapshots_design_file_id_fkey"
            columns: ["design_file_id"]
            isOneToOne: false
            referencedRelation: "design_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_snapshots_document_asset_id_fkey"
            columns: ["document_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_snapshots_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      font_pairs: {
        Row: {
          body_font_id: string
          enabled: boolean
          heading_font_id: string
          id: string
          mood_tags: string[]
          name: string
          sort_order: number
          ui_font_id: string
        }
        Insert: {
          body_font_id: string
          enabled?: boolean
          heading_font_id: string
          id?: string
          mood_tags?: string[]
          name: string
          sort_order?: number
          ui_font_id: string
        }
        Update: {
          body_font_id?: string
          enabled?: boolean
          heading_font_id?: string
          id?: string
          mood_tags?: string[]
          name?: string
          sort_order?: number
          ui_font_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "font_pairs_body_font_id_fkey"
            columns: ["body_font_id"]
            isOneToOne: false
            referencedRelation: "fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "font_pairs_heading_font_id_fkey"
            columns: ["heading_font_id"]
            isOneToOne: false
            referencedRelation: "fonts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "font_pairs_ui_font_id_fkey"
            columns: ["ui_font_id"]
            isOneToOne: false
            referencedRelation: "fonts"
            referencedColumns: ["id"]
          },
        ]
      }
      fonts: {
        Row: {
          ascent_override: string | null
          attribution_required: boolean
          category: string
          created_at: string
          descent_override: string | null
          enabled: boolean
          fallback_stack: string | null
          family: string
          file_manifest: Json
          id: string
          license_file_key: string | null
          license_name: string
          license_url: string
          preview_text: string | null
          slug: string
          sort_order: number
          styles: string[]
          subset_strategy: string
          supported_languages: string[]
          weights: number[]
        }
        Insert: {
          ascent_override?: string | null
          attribution_required?: boolean
          category: string
          created_at?: string
          descent_override?: string | null
          enabled?: boolean
          fallback_stack?: string | null
          family: string
          file_manifest?: Json
          id?: string
          license_file_key?: string | null
          license_name: string
          license_url: string
          preview_text?: string | null
          slug: string
          sort_order?: number
          styles?: string[]
          subset_strategy?: string
          supported_languages?: string[]
          weights?: number[]
        }
        Update: {
          ascent_override?: string | null
          attribution_required?: boolean
          category?: string
          created_at?: string
          descent_override?: string | null
          enabled?: boolean
          fallback_stack?: string | null
          family?: string
          file_manifest?: Json
          id?: string
          license_file_key?: string | null
          license_name?: string
          license_url?: string
          preview_text?: string | null
          slug?: string
          sort_order?: number
          styles?: string[]
          subset_strategy?: string
          supported_languages?: string[]
          weights?: number[]
        }
        Relationships: []
      }
      insights: {
        Row: {
          confidence: number
          created_at: string
          deleted_at: string | null
          evidence: Json
          id: string
          period_end: string | null
          period_start: string | null
          space_id: string
          statement: string
          title: string
          type: string
          visibility: string
        }
        Insert: {
          confidence: number
          created_at?: string
          deleted_at?: string | null
          evidence?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          space_id: string
          statement: string
          title: string
          type: string
          visibility?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          deleted_at?: string | null
          evidence?: Json
          id?: string
          period_end?: string | null
          period_start?: string | null
          space_id?: string
          statement?: string
          title?: string
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_records: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          last_error: string | null
          payload: Json
          result: Json | null
          retry_count: number
          space_id: string | null
          started_at: string | null
          status: string
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          space_id?: string | null
          started_at?: string | null
          status?: string
          type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          space_id?: string | null
          started_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_records_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      layouts: {
        Row: {
          breakpoint_config: Json
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          name: string
          space_id: string
          updated_at: string
        }
        Insert: {
          breakpoint_config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          space_id: string
          updated_at?: string
        }
        Update: {
          breakpoint_config?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layouts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          approved: boolean
          confidence: number
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          embedding: string | null
          expires_at: string | null
          id: string
          rejected_at: string | null
          sensitivity: string
          source_id: string | null
          source_message_id: string | null
          source_type: string
          space_id: string
          type: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          confidence?: number
          content: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          sensitivity?: string
          source_id?: string | null
          source_message_id?: string | null
          source_type: string
          space_id: string
          type: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          confidence?: number
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          embedding?: string | null
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          sensitivity?: string
          source_id?: string | null
          source_message_id?: string | null
          source_type?: string
          space_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          channel: string
          created_at: string
          id: string
          link: string | null
          payload: Json
          read_at: string | null
          space_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          channel?: string
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          space_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          channel?: string
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json
          read_at?: string | null
          space_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_transactions: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          intent: string
          nonce: string
          provider: string
          redirect_to: string | null
          state: string
          user_id: string | null
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          intent: string
          nonce: string
          provider: string
          redirect_to?: string | null
          state: string
          user_id?: string | null
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          intent?: string
          nonce?: string
          provider?: string
          redirect_to?: string | null
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          cover_asset_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          last_activity_at: string
          name: string
          space_id: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_activity_at?: string
          name: string
          space_id: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          cover_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          last_activity_at?: string
          name?: string
          space_id?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_webhooks: {
        Row: {
          connection_id: string | null
          external_event_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          signature_ok: boolean
        }
        Insert: {
          connection_id?: string | null
          external_event_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_ok: boolean
        }
        Update: {
          connection_id?: string | null
          external_event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_ok?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "provider_webhooks_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "design_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          checksum: string
          version: string
        }
        Insert: {
          applied_at?: string
          checksum: string
          version: string
        }
        Update: {
          applied_at?: string
          checksum?: string
          version?: string
        }
        Relationships: []
      }
      space_feature_overrides: {
        Row: {
          enabled: boolean
          key: string
          space_id: string
        }
        Insert: {
          enabled: boolean
          key: string
          space_id: string
        }
        Update: {
          enabled?: boolean
          key?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_feature_overrides_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "space_feature_overrides_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          role: string
          space_id: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          role?: string
          space_id?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          role?: string
          space_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_invites_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          joined_at: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role: string
          space_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_settings: {
        Row: {
          activity_tracking: boolean
          agent_mode: string
          agent_position: string
          agent_proactive: string
          agent_tone: string
          agent_visible: boolean
          ai_analysis_enabled: boolean
          background_audio_asset_id: string | null
          background_audio_enabled: boolean
          background_audio_volume: number
          created_at: string
          daily_enabled: boolean
          memory_enabled: boolean
          motion_preference: string
          provider_data_enabled: boolean
          public_sharing_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sound_enabled: boolean
          space_id: string
          surprise_pity_counter: number
          updated_at: string
          weather_city: string | null
          weather_enabled: boolean
        }
        Insert: {
          activity_tracking?: boolean
          agent_mode?: string
          agent_position?: string
          agent_proactive?: string
          agent_tone?: string
          agent_visible?: boolean
          ai_analysis_enabled?: boolean
          background_audio_asset_id?: string | null
          background_audio_enabled?: boolean
          background_audio_volume?: number
          created_at?: string
          daily_enabled?: boolean
          memory_enabled?: boolean
          motion_preference?: string
          provider_data_enabled?: boolean
          public_sharing_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sound_enabled?: boolean
          space_id: string
          surprise_pity_counter?: number
          updated_at?: string
          weather_city?: string | null
          weather_enabled?: boolean
        }
        Update: {
          activity_tracking?: boolean
          agent_mode?: string
          agent_position?: string
          agent_proactive?: string
          agent_tone?: string
          agent_visible?: boolean
          ai_analysis_enabled?: boolean
          background_audio_asset_id?: string | null
          background_audio_enabled?: boolean
          background_audio_volume?: number
          created_at?: string
          daily_enabled?: boolean
          memory_enabled?: boolean
          motion_preference?: string
          provider_data_enabled?: boolean
          public_sharing_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sound_enabled?: boolean
          space_id?: string
          surprise_pity_counter?: number
          updated_at?: string
          weather_city?: string | null
          weather_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "space_settings_background_audio_asset_id_fkey"
            columns: ["background_audio_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_settings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          active_layout_id: string | null
          active_playlist_id: string | null
          active_theme_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
          privacy: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active_layout_id?: string | null
          active_playlist_id?: string | null
          active_theme_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
          privacy?: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_layout_id?: string | null
          active_playlist_id?: string | null
          active_theme_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          privacy?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_active_layout_fk"
            columns: ["active_layout_id"]
            isOneToOne: false
            referencedRelation: "layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_active_playlist_fk"
            columns: ["active_playlist_id"]
            isOneToOne: false
            referencedRelation: "background_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spaces_active_theme_fk"
            columns: ["active_theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      surprises: {
        Row: {
          available_from: string
          body: string | null
          chain_index: number | null
          chain_key: string | null
          created_at: string
          expires_at: string | null
          favorited: boolean
          id: string
          kind: string
          payload: Json
          rarity: string
          source_ref: string | null
          space_id: string
          title: string
          unlocked_at: string | null
        }
        Insert: {
          available_from?: string
          body?: string | null
          chain_index?: number | null
          chain_key?: string | null
          created_at?: string
          expires_at?: string | null
          favorited?: boolean
          id?: string
          kind: string
          payload?: Json
          rarity: string
          source_ref?: string | null
          space_id: string
          title: string
          unlocked_at?: string | null
        }
        Update: {
          available_from?: string
          body?: string | null
          chain_index?: number | null
          chain_key?: string | null
          created_at?: string
          expires_at?: string | null
          favorited?: boolean
          id?: string
          kind?: string
          payload?: Json
          rarity?: string
          source_ref?: string | null
          space_id?: string
          title?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surprises_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_versions: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          id: string
          label: string | null
          space_id: string
          theme_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          id?: string
          label?: string | null
          space_id: string
          theme_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          id?: string
          label?: string | null
          space_id?: string
          theme_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "theme_versions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theme_versions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          a11y_report: Json
          created_at: string
          created_by: string | null
          definition: Json
          deleted_at: string | null
          id: string
          is_favorite: boolean
          is_preset: boolean
          name: string
          source: string
          source_asset_id: string | null
          space_id: string
          updated_at: string
        }
        Insert: {
          a11y_report?: Json
          created_at?: string
          created_by?: string | null
          definition: Json
          deleted_at?: string | null
          id?: string
          is_favorite?: boolean
          is_preset?: boolean
          name: string
          source?: string
          source_asset_id?: string | null
          space_id: string
          updated_at?: string
        }
        Update: {
          a11y_report?: Json
          created_at?: string
          created_by?: string | null
          definition?: Json
          deleted_at?: string | null
          id?: string
          is_favorite?: boolean
          is_preset?: boolean
          name?: string
          source?: string
          source_asset_id?: string | null
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "themes_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "themes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          body: string | null
          cover_asset_id: string | null
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          occurred_at: string
          project_id: string | null
          source_event_id: string | null
          space_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          body?: string | null
          cover_asset_id?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          occurred_at: string
          project_id?: string | null
          source_event_id?: string | null
          space_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          body?: string | null
          cover_asset_id?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          project_id?: string | null
          source_event_id?: string | null
          space_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_identities: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          id: string
          last_used_at: string | null
          line_user_id: string | null
          linked_at: string
          provider: string
          provider_uid: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_used_at?: string | null
          line_user_id?: string | null
          linked_at?: string
          provider: string
          provider_uid: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_used_at?: string | null
          line_user_id?: string | null
          linked_at?: string
          provider?: string
          provider_uid?: string
          user_id?: string
        }
        Relationships: []
      }
      widget_definitions: {
        Row: {
          category: string
          config_schema: Json
          default_h: number
          default_w: number
          description: string | null
          enabled: boolean
          feature_flag: string | null
          id: string
          max_h: number
          max_w: number
          min_h: number
          min_w: number
          name: string
          permissions: string[]
          sort_order: number
          version: string
        }
        Insert: {
          category: string
          config_schema?: Json
          default_h: number
          default_w: number
          description?: string | null
          enabled?: boolean
          feature_flag?: string | null
          id: string
          max_h: number
          max_w: number
          min_h: number
          min_w: number
          name: string
          permissions?: string[]
          sort_order?: number
          version: string
        }
        Update: {
          category?: string
          config_schema?: Json
          default_h?: number
          default_w?: number
          description?: string | null
          enabled?: boolean
          feature_flag?: string | null
          id?: string
          max_h?: number
          max_w?: number
          min_h?: number
          min_w?: number
          name?: string
          permissions?: string[]
          sort_order?: number
          version?: string
        }
        Relationships: []
      }
      widget_instances: {
        Row: {
          config: Json
          created_at: string
          hidden: boolean
          id: string
          layout_id: string
          locked: boolean
          position: Json
          space_id: string
          updated_at: string
          widget_definition_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          hidden?: boolean
          id?: string
          layout_id: string
          locked?: boolean
          position?: Json
          space_id: string
          updated_at?: string
          widget_definition_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          hidden?: boolean
          id?: string
          layout_id?: string
          locked?: boolean
          position?: Json
          space_id?: string
          updated_at?: string
          widget_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_instances_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_instances_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_instances_widget_definition_id_fkey"
            columns: ["widget_definition_id"]
            isOneToOne: false
            referencedRelation: "widget_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_ai_quota: {
        Args: { p_is_free: boolean; p_local_date: string; p_space_id: string }
        Returns: undefined
      }
      is_space_member: { Args: { target_space_id: string }; Returns: boolean }
      is_space_owner: { Args: { target_space_id: string }; Returns: boolean }
      purge_space: { Args: { target_space_id: string }; Returns: undefined }
      reorder_playlist_items: {
        Args: { ordered_ids: string[]; target_playlist_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      space_storage_bytes: {
        Args: { target_space_id: string }
        Returns: number
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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

