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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      admin_import_backups: {
        Row: {
          actor_id: string
          content_type: string
          created_at: string
          id: string
          key_field: string
          row_count: number
          rows: Json
          source_file: string | null
        }
        Insert: {
          actor_id: string
          content_type: string
          created_at?: string
          id?: string
          key_field: string
          row_count: number
          rows: Json
          source_file?: string | null
        }
        Update: {
          actor_id?: string
          content_type?: string
          created_at?: string
          id?: string
          key_field?: string
          row_count?: number
          rows?: Json
          source_file?: string | null
        }
        Relationships: []
      }
      admin_import_jobs: {
        Row: {
          actor_id: string
          content_type: string
          created_at: string
          errors: Json
          failed_rows: number
          file_name: string | null
          id: string
          mode: string
          skipped_rows: number
          status: string
          success_rows: number
          total_rows: number
        }
        Insert: {
          actor_id: string
          content_type: string
          created_at?: string
          errors?: Json
          failed_rows?: number
          file_name?: string | null
          id?: string
          mode: string
          skipped_rows?: number
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Update: {
          actor_id?: string
          content_type?: string
          created_at?: string
          errors?: Json
          failed_rows?: number
          file_name?: string | null
          id?: string
          mode?: string
          skipped_rows?: number
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          system_role: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          system_role?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          system_role?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      class_announcements: {
        Row: {
          body: string
          class_id: string
          created_at: string
          id: string
          is_published: boolean
          title: string
        }
        Insert: {
          body: string
          class_id: string
          created_at?: string
          id?: string
          is_published?: boolean
          title: string
        }
        Update: {
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_announcements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_assignment_submissions: {
        Row: {
          answer_text: string | null
          assignment_id: string
          attachment_url: string | null
          id: string
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          answer_text?: string | null
          assignment_id: string
          attachment_url?: string | null
          id?: string
          status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          answer_text?: string | null
          assignment_id?: string
          attachment_url?: string | null
          id?: string
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "class_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      class_assignments: {
        Row: {
          allow_late: boolean
          category: string
          class_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          is_published: boolean
          max_score: number | null
          submission_type: string
          title: string
          topic: string | null
        }
        Insert: {
          allow_late?: boolean
          category?: string
          class_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_published?: boolean
          max_score?: number | null
          submission_type?: string
          title: string
          topic?: string | null
        }
        Update: {
          allow_late?: boolean
          category?: string
          class_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          is_published?: boolean
          max_score?: number | null
          submission_type?: string
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_banners: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
        }
        Relationships: []
      }
      class_enrollments: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          status: string
          user_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          status?: string
          user_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_grades: {
        Row: {
          assignment_id: string | null
          class_id: string
          feedback: string | null
          id: string
          score: number | null
          updated_at: string
          user_id: string
          weakness_note: string | null
        }
        Insert: {
          assignment_id?: string | null
          class_id: string
          feedback?: string | null
          id?: string
          score?: number | null
          updated_at?: string
          user_id: string
          weakness_note?: string | null
        }
        Update: {
          assignment_id?: string | null
          class_id?: string
          feedback?: string | null
          id?: string
          score?: number | null
          updated_at?: string
          user_id?: string
          weakness_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_grades_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "class_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_materials: {
        Row: {
          class_id: string
          content_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          sort_order: number
          title: string
        }
        Insert: {
          class_id: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          class_id?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_meetings: {
        Row: {
          class_id: string
          created_at: string
          meeting_id: string | null
          meeting_url: string
          passcode: string | null
          reveal_from: string | null
          reveal_until: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          meeting_id?: string | null
          meeting_url: string
          passcode?: string | null
          reveal_from?: string | null
          reveal_until?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          meeting_id?: string | null
          meeting_url?: string
          passcode?: string | null
          reveal_from?: string | null
          reveal_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_meetings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: true
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_quiz_attempts: {
        Row: {
          answers: Json
          correct_count: number
          id: string
          quiz_id: string
          score: number
          submitted_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          correct_count?: number
          id?: string
          quiz_id: string
          score?: number
          submitted_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json
          correct_count?: number
          id?: string
          quiz_id?: string
          score?: number
          submitted_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "class_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_quiz_questions: {
        Row: {
          category: string
          choices: Json
          correct_index: number
          explanation: string | null
          id: string
          question: string
          quiz_id: string
          sort_order: number
          topic: string | null
        }
        Insert: {
          category?: string
          choices?: Json
          correct_index?: number
          explanation?: string | null
          id?: string
          question: string
          quiz_id: string
          sort_order?: number
          topic?: string | null
        }
        Update: {
          category?: string
          choices?: Json
          correct_index?: number
          explanation?: string | null
          id?: string
          question?: string
          quiz_id?: string
          sort_order?: number
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "class_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_quizzes: {
        Row: {
          class_id: string
          created_at: string
          description: string | null
          due_at: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_quizzes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule: {
        Row: {
          class_id: string
          created_at: string
          ends_at: string | null
          id: string
          location_label: string | null
          meeting_id: string | null
          meeting_url: string | null
          passcode: string | null
          starts_at: string
          title: string
        }
        Insert: {
          class_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location_label?: string | null
          meeting_id?: string | null
          meeting_url?: string | null
          passcode?: string | null
          starts_at: string
          title: string
        }
        Update: {
          class_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          location_label?: string | null
          meeting_id?: string | null
          meeting_url?: string | null
          passcode?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          banner_url: string | null
          capacity: number | null
          class_mode: string
          created_at: string
          currency: string
          description: string | null
          ends_at: string | null
          id: string
          level: string
          price: number
          slug: string | null
          starts_at: string | null
          status: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          capacity?: number | null
          class_mode?: string
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          level: string
          price?: number
          slug?: string | null
          starts_at?: string | null
          status?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          capacity?: number | null
          class_mode?: string
          created_at?: string
          currency?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          level?: string
          price?: number
          slug?: string | null
          starts_at?: string | null
          status?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          assigned_to: string | null
          category: string
          chat_category: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          reporter_id: string | null
          resolution_note: string | null
          status: string
          subject: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          chat_category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reporter_id?: string | null
          resolution_note?: string | null
          status?: string
          subject: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          chat_category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reporter_id?: string | null
          resolution_note?: string | null
          status?: string
          subject?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_review_status: {
        Row: {
          content_id: string
          content_type: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content_id: string
          content_type: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_sources: {
        Row: {
          code: string
          created_at: string
          curriculum_family: string | null
          id: string
          level: Database["public"]["Enums"]["jlpt_level"] | null
          name: string
          notes: string | null
          priority: number
          source_kind: string
          ui_unit_label: string
        }
        Insert: {
          code: string
          created_at?: string
          curriculum_family?: string | null
          id?: string
          level?: Database["public"]["Enums"]["jlpt_level"] | null
          name: string
          notes?: string | null
          priority?: number
          source_kind?: string
          ui_unit_label?: string
        }
        Update: {
          code?: string
          created_at?: string
          curriculum_family?: string | null
          id?: string
          level?: Database["public"]["Enums"]["jlpt_level"] | null
          name?: string
          notes?: string | null
          priority?: number
          source_kind?: string
          ui_unit_label?: string
        }
        Relationships: []
      }
      content_translations: {
        Row: {
          attempts: number
          created_at: string
          id: string
          language: string
          last_error: string | null
          model: string | null
          source_field: string
          source_id: string
          source_text: string
          source_type: string
          status: string
          translated_at: string | null
          translated_text: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          language?: string
          last_error?: string | null
          model?: string | null
          source_field: string
          source_id: string
          source_text: string
          source_type: string
          status?: string
          translated_at?: string | null
          translated_text?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          language?: string
          last_error?: string | null
          model?: string | null
          source_field?: string
          source_id?: string
          source_text?: string
          source_type?: string
          status?: string
          translated_at?: string | null
          translated_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_study_tasks: {
        Row: {
          completed_at: string | null
          completed_count: number
          created_at: string
          id: string
          metadata: Json
          plan_id: string
          priority: number
          reason: string | null
          study_date: string
          target_count: number
          task_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          id?: string
          metadata?: Json
          plan_id: string
          priority?: number
          reason?: string | null
          study_date?: string
          target_count: number
          task_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          id?: string
          metadata?: Json
          plan_id?: string
          priority?: number
          reason?: string | null
          study_date?: string
          target_count?: number
          task_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_study_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_product_purchases: {
        Row: {
          amount_idr: number
          buyer_id: string
          created_at: string
          delivered_at: string | null
          delivery_attempts: number
          delivery_email: string
          delivery_status: string
          id: string
          paid_at: string | null
          payment_order_id: string | null
          product_id: string
          status: string
        }
        Insert: {
          amount_idr: number
          buyer_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          delivery_email: string
          delivery_status?: string
          id?: string
          paid_at?: string | null
          payment_order_id?: string | null
          product_id: string
          status?: string
        }
        Update: {
          amount_idr?: number
          buyer_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          delivery_email?: string
          delivery_status?: string
          id?: string
          paid_at?: string | null
          payment_order_id?: string | null
          product_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_product_purchases_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_product_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "digital_products"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_products: {
        Row: {
          category: string
          cover_path: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          preview_paths: string[]
          price_idr: number
          related_class_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          preview_paths?: string[]
          price_idr: number
          related_class_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          preview_paths?: string[]
          price_idr?: number
          related_class_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_products_related_class_id_fkey"
            columns: ["related_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_conversation_hidden: {
        Row: {
          conversation_id: string
          hidden_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_conversation_hidden_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_conversations: {
        Row: {
          created_at: string
          high_last_read_at: string
          id: string
          last_message_at: string
          low_last_read_at: string
          user_high: string
          user_low: string
        }
        Insert: {
          created_at?: string
          high_last_read_at?: string
          id?: string
          last_message_at?: string
          low_last_read_at?: string
          user_high: string
          user_low: string
        }
        Update: {
          created_at?: string
          high_last_read_at?: string
          id?: string
          last_message_at?: string
          low_last_read_at?: string
          user_high?: string
          user_low?: string
        }
        Relationships: []
      }
      dm_messages: {
        Row: {
          body: string
          client_id: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          recipient_id: string
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          body: string
          client_id?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          recipient_id: string
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          client_id?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          recipient_id?: string
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "dm_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      eno_monthly_exam_attempts: {
        Row: {
          answers: Json
          attempt_no: number
          correct_count: number | null
          created_at: string
          duration_seconds: number | null
          exam_id: string
          id: string
          invalidation_reason: string | null
          retake_granted_by: string | null
          score: number | null
          started_at: string
          status: string
          submitted_at: string | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          answers?: Json
          attempt_no?: number
          correct_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          exam_id: string
          id?: string
          invalidation_reason?: string | null
          retake_granted_by?: string | null
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          answers?: Json
          attempt_no?: number
          correct_count?: number | null
          created_at?: string
          duration_seconds?: number | null
          exam_id?: string
          id?: string
          invalidation_reason?: string | null
          retake_granted_by?: string | null
          score?: number | null
          started_at?: string
          status?: string
          submitted_at?: string | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eno_monthly_exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "eno_monthly_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      eno_monthly_exam_questions: {
        Row: {
          audio_url: string | null
          choices: Json
          correct_index: number
          created_at: string
          created_by: string | null
          exam_id: string
          explanation_indonesian: string | null
          id: string
          image_url: string | null
          instruction_jp: string | null
          mondai_no: number
          passage_jp: string | null
          prompt_jp: string
          question_no: number
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          choices: Json
          correct_index: number
          created_at?: string
          created_by?: string | null
          exam_id: string
          explanation_indonesian?: string | null
          id?: string
          image_url?: string | null
          instruction_jp?: string | null
          mondai_no?: number
          passage_jp?: string | null
          prompt_jp: string
          question_no: number
          section: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          choices?: Json
          correct_index?: number
          created_at?: string
          created_by?: string | null
          exam_id?: string
          explanation_indonesian?: string | null
          id?: string
          image_url?: string | null
          instruction_jp?: string | null
          mondai_no?: number
          passage_jp?: string | null
          prompt_jp?: string
          question_no?: number
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eno_monthly_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "eno_monthly_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      eno_monthly_exams: {
        Row: {
          closes_at: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          exam_month: string
          id: string
          level: string
          max_attempts: number
          opens_at: string
          passing_score: number
          premium_only: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          exam_month: string
          id?: string
          level: string
          max_attempts?: number
          opens_at: string
          passing_score?: number
          premium_only?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          exam_month?: string
          id?: string
          level?: string
          max_attempts?: number
          opens_at?: string
          passing_score?: number
          premium_only?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          aspect: string
          client_event_id: string | null
          created_at: string
          direction: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          level: Database["public"]["Enums"]["jlpt_level"]
          meta: Json
          rating: number
          response_ms: number | null
          session_id: string | null
          used_hint: boolean
          user_id: string
        }
        Insert: {
          aspect?: string
          client_event_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          level: Database["public"]["Enums"]["jlpt_level"]
          meta?: Json
          rating: number
          response_ms?: number | null
          session_id?: string | null
          used_hint?: boolean
          user_id: string
        }
        Update: {
          aspect?: string
          client_event_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["content_skill"]
          level?: Database["public"]["Enums"]["jlpt_level"]
          meta?: Json
          rating?: number
          response_ms?: number | null
          session_id?: string | null
          used_hint?: boolean
          user_id?: string
        }
        Relationships: []
      }
      global_messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          id: string
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "global_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      grammar_curriculum: {
        Row: {
          created_at: string
          id: string
          lesson_number: number
          level: Database["public"]["Enums"]["jlpt_level"]
          pattern: string
          sort_order: number
          source_book: string
          source_page: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_number: number
          level: Database["public"]["Enums"]["jlpt_level"]
          pattern: string
          sort_order?: number
          source_book: string
          source_page?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          lesson_number?: number
          level?: Database["public"]["Enums"]["jlpt_level"]
          pattern?: string
          sort_order?: number
          source_book?: string
          source_page?: number | null
        }
        Relationships: []
      }
      grammar_curriculum_n3_rebuild: {
        Row: {
          created_at: string
          day_number: number
          examples: Json | null
          explanation_id: string | null
          id: string
          meaning_id: string | null
          notes_id: string | null
          pattern: string
          pattern_order: number
          reading_hiragana: string | null
          romaji: string | null
          source_book: string
          source_page: number | null
          status: string
          structure: string | null
          usage_id: string | null
          wrong_examples: Json | null
        }
        Insert: {
          created_at?: string
          day_number: number
          examples?: Json | null
          explanation_id?: string | null
          id?: string
          meaning_id?: string | null
          notes_id?: string | null
          pattern: string
          pattern_order: number
          reading_hiragana?: string | null
          romaji?: string | null
          source_book?: string
          source_page?: number | null
          status?: string
          structure?: string | null
          usage_id?: string | null
          wrong_examples?: Json | null
        }
        Update: {
          created_at?: string
          day_number?: number
          examples?: Json | null
          explanation_id?: string | null
          id?: string
          meaning_id?: string | null
          notes_id?: string | null
          pattern?: string
          pattern_order?: number
          reading_hiragana?: string | null
          romaji?: string | null
          source_book?: string
          source_page?: number | null
          status?: string
          structure?: string | null
          usage_id?: string | null
          wrong_examples?: Json | null
        }
        Relationships: []
      }
      grammar_form_requirements: {
        Row: {
          connector: string | null
          created_at: string
          grammar_id: string
          id: string
          notes_id: string | null
          provenance: string
          raw_formula: string | null
          required_form_code: string | null
          slot_order: number
          source_book: string | null
          source_reference: string | null
          word_class: string | null
        }
        Insert: {
          connector?: string | null
          created_at?: string
          grammar_id: string
          id?: string
          notes_id?: string | null
          provenance?: string
          raw_formula?: string | null
          required_form_code?: string | null
          slot_order?: number
          source_book?: string | null
          source_reference?: string | null
          word_class?: string | null
        }
        Update: {
          connector?: string | null
          created_at?: string
          grammar_id?: string
          id?: string
          notes_id?: string | null
          provenance?: string
          raw_formula?: string | null
          required_form_code?: string | null
          slot_order?: number
          source_book?: string | null
          source_reference?: string | null
          word_class?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grammar_form_requirements_grammar_id_fkey"
            columns: ["grammar_id"]
            isOneToOne: false
            referencedRelation: "grammar_points"
            referencedColumns: ["id"]
          },
        ]
      }
      grammar_points: {
        Row: {
          created_at: string
          examples: Json
          explanation_en: string | null
          explanation_id: string | null
          id: string
          is_published: boolean
          lesson_number: number | null
          lesson_title: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string | null
          meaning_id: string
          notes_id: string | null
          pattern: string
          reading_hiragana: string | null
          romaji: string | null
          sort_order: number
          source_book: string | null
          structure: string | null
          usage_id: string | null
          wrong_examples: Json
        }
        Insert: {
          created_at?: string
          examples?: Json
          explanation_en?: string | null
          explanation_id?: string | null
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en?: string | null
          meaning_id: string
          notes_id?: string | null
          pattern: string
          reading_hiragana?: string | null
          romaji?: string | null
          sort_order?: number
          source_book?: string | null
          structure?: string | null
          usage_id?: string | null
          wrong_examples?: Json
        }
        Update: {
          created_at?: string
          examples?: Json
          explanation_en?: string | null
          explanation_id?: string | null
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          meaning_en?: string | null
          meaning_id?: string
          notes_id?: string | null
          pattern?: string
          reading_hiragana?: string | null
          romaji?: string | null
          sort_order?: number
          source_book?: string | null
          structure?: string | null
          usage_id?: string | null
          wrong_examples?: Json
        }
        Relationships: []
      }
      jlpt_simulation_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_index: number
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_index: number
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "jlpt_simulation_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jlpt_simulation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jlpt_simulation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      jlpt_simulation_attempt_questions: {
        Row: {
          attempt_id: string
          created_at: string
          question_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          question_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jlpt_simulation_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jlpt_simulation_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jlpt_simulation_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      jlpt_simulation_attempts: {
        Row: {
          completed_at: string
          correct_count: number
          created_at: string
          duration_seconds: number
          full_session_id: string | null
          id: string
          level: string
          section: string
          session_index: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          correct_count: number
          created_at?: string
          duration_seconds?: number
          full_session_id?: string | null
          id?: string
          level: string
          section: string
          session_index?: number | null
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          full_session_id?: string | null
          id?: string
          level?: string
          section?: string
          session_index?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jlpt_simulation_attempts_full_session_id_fkey"
            columns: ["full_session_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_full_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      jlpt_simulation_audio_source_map: {
        Row: {
          created_at: string
          delivery_path: string | null
          drive_file_id: string
          drive_url: string
          exam_no: number
          file_name: string
          id: string
          is_scored: boolean
          level: string
          mapping_scope: string
          mondai_no: number | null
          notes: string | null
          question_no: number | null
          question_timeline: Json | null
          simulation_question_id: string | null
          source_choices: Json | null
          source_correct_index: number | null
          source_format: string | null
          source_key_reference: string | null
          source_key_verified: boolean
          source_pdf_file_id: string | null
          status: string
          structure_verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          delivery_path?: string | null
          drive_file_id: string
          drive_url: string
          exam_no?: number
          file_name: string
          id?: string
          is_scored?: boolean
          level: string
          mapping_scope: string
          mondai_no?: number | null
          notes?: string | null
          question_no?: number | null
          question_timeline?: Json | null
          simulation_question_id?: string | null
          source_choices?: Json | null
          source_correct_index?: number | null
          source_format?: string | null
          source_key_reference?: string | null
          source_key_verified?: boolean
          source_pdf_file_id?: string | null
          status?: string
          structure_verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          delivery_path?: string | null
          drive_file_id?: string
          drive_url?: string
          exam_no?: number
          file_name?: string
          id?: string
          is_scored?: boolean
          level?: string
          mapping_scope?: string
          mondai_no?: number | null
          notes?: string | null
          question_no?: number | null
          question_timeline?: Json | null
          simulation_question_id?: string | null
          source_choices?: Json | null
          source_correct_index?: number | null
          source_format?: string | null
          source_key_reference?: string | null
          source_key_verified?: boolean
          source_pdf_file_id?: string | null
          status?: string
          structure_verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jlpt_simulation_audio_source_map_simulation_question_id_fkey"
            columns: ["simulation_question_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jlpt_simulation_audio_source_map_simulation_question_id_fkey"
            columns: ["simulation_question_id"]
            isOneToOne: false
            referencedRelation: "jlpt_simulation_questions_public"
            referencedColumns: ["id"]
          },
        ]
      }
      jlpt_simulation_full_sessions: {
        Row: {
          certificate_token: string | null
          completed_at: string | null
          created_at: string
          exam_no: number
          id: string
          level: string
          passed: boolean | null
          started_at: string
          status: string
          total_score: number | null
          user_id: string
        }
        Insert: {
          certificate_token?: string | null
          completed_at?: string | null
          created_at?: string
          exam_no?: number
          id?: string
          level: string
          passed?: boolean | null
          started_at?: string
          status?: string
          total_score?: number | null
          user_id: string
        }
        Update: {
          certificate_token?: string | null
          completed_at?: string | null
          created_at?: string
          exam_no?: number
          id?: string
          level?: string
          passed?: boolean | null
          started_at?: string
          status?: string
          total_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      jlpt_simulation_questions: {
        Row: {
          audio_url: string | null
          choices: Json
          correct_index: number
          created_at: string
          display_question_no: number | null
          exam_no: number
          explanation_indonesian: string | null
          id: string
          image_prompt: string | null
          image_url: string | null
          instruction_jp: string
          is_published: boolean
          level: string
          mondai_no: number
          passage_jp: string | null
          passage_title: string | null
          prompt_jp: string
          question_no: number
          question_type: string
          section: string
          session_no: number
          source_kind: string
          target_occurrence: number | null
          target_text: string | null
          test_type: string
          transcript_jp: string | null
        }
        Insert: {
          audio_url?: string | null
          choices: Json
          correct_index: number
          created_at?: string
          display_question_no?: number | null
          exam_no?: number
          explanation_indonesian?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          instruction_jp: string
          is_published?: boolean
          level: string
          mondai_no: number
          passage_jp?: string | null
          passage_title?: string | null
          prompt_jp: string
          question_no: number
          question_type: string
          section: string
          session_no?: number
          source_kind?: string
          target_occurrence?: number | null
          target_text?: string | null
          test_type?: string
          transcript_jp?: string | null
        }
        Update: {
          audio_url?: string | null
          choices?: Json
          correct_index?: number
          created_at?: string
          display_question_no?: number | null
          exam_no?: number
          explanation_indonesian?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          instruction_jp?: string
          is_published?: boolean
          level?: string
          mondai_no?: number
          passage_jp?: string | null
          passage_title?: string | null
          prompt_jp?: string
          question_no?: number
          question_type?: string
          section?: string
          session_no?: number
          source_kind?: string
          target_occurrence?: number | null
          target_text?: string | null
          test_type?: string
          transcript_jp?: string | null
        }
        Relationships: []
      }
      kanji: {
        Row: {
          character: string
          created_at: string
          id: string
          is_published: boolean
          kunyomi: string[]
          lesson_number: number | null
          lesson_title: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string | null
          meaning_id: string
          onyomi: string[]
          sort_order: number
          source_book: string | null
          stroke_count: number | null
        }
        Insert: {
          character: string
          created_at?: string
          id?: string
          is_published?: boolean
          kunyomi?: string[]
          lesson_number?: number | null
          lesson_title?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en?: string | null
          meaning_id: string
          onyomi?: string[]
          sort_order?: number
          source_book?: string | null
          stroke_count?: number | null
        }
        Update: {
          character?: string
          created_at?: string
          id?: string
          is_published?: boolean
          kunyomi?: string[]
          lesson_number?: number | null
          lesson_title?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          meaning_en?: string | null
          meaning_id?: string
          onyomi?: string[]
          sort_order?: number
          source_book?: string | null
          stroke_count?: number | null
        }
        Relationships: []
      }
      kanji_components: {
        Row: {
          depth: number
          element: string
          kanji_id: string
          node_id: number
          ord: number
          parent_id: number | null
          role: string | null
          role_source: string | null
        }
        Insert: {
          depth: number
          element: string
          kanji_id: string
          node_id: number
          ord: number
          parent_id?: number | null
          role?: string | null
          role_source?: string | null
        }
        Update: {
          depth?: number
          element?: string
          kanji_id?: string
          node_id?: number
          ord?: number
          parent_id?: number | null
          role?: string | null
          role_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanji_components_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: false
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
        ]
      }
      kanji_curriculum: {
        Row: {
          character: string
          created_at: string
          id: string
          kanji_id: string | null
          lesson_number: number
          level: Database["public"]["Enums"]["jlpt_level"]
          sort_order: number
          source_book: string
        }
        Insert: {
          character: string
          created_at?: string
          id?: string
          kanji_id?: string | null
          lesson_number: number
          level: Database["public"]["Enums"]["jlpt_level"]
          sort_order?: number
          source_book: string
        }
        Update: {
          character?: string
          created_at?: string
          id?: string
          kanji_id?: string | null
          lesson_number?: number
          level?: Database["public"]["Enums"]["jlpt_level"]
          sort_order?: number
          source_book?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanji_curriculum_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: false
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
        ]
      }
      kanji_mnemonics: {
        Row: {
          basis: string
          body: string
          kanji_id: string
        }
        Insert: {
          basis?: string
          body: string
          kanji_id: string
        }
        Update: {
          basis?: string
          body?: string
          kanji_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanji_mnemonics_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: true
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
        ]
      }
      kanji_radical_forms: {
        Row: {
          base_char: string
          form_char: string
          is_variant: boolean
        }
        Insert: {
          base_char: string
          form_char: string
          is_variant: boolean
        }
        Update: {
          base_char?: string
          form_char?: string
          is_variant?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "kanji_radical_forms_base_char_fkey"
            columns: ["base_char"]
            isOneToOne: false
            referencedRelation: "kanji_radicals"
            referencedColumns: ["base_char"]
          },
        ]
      }
      kanji_radical_names: {
        Row: {
          base_char: string
          name_ja: string
          position_class: string
        }
        Insert: {
          base_char: string
          name_ja: string
          position_class: string
        }
        Update: {
          base_char?: string
          name_ja?: string
          position_class?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanji_radical_names_base_char_fkey"
            columns: ["base_char"]
            isOneToOne: false
            referencedRelation: "kanji_radicals"
            referencedColumns: ["base_char"]
          },
        ]
      }
      kanji_radicals: {
        Row: {
          base_char: string
          meaning_en: string
          meaning_id: string
          name_ja: string
          source: string
        }
        Insert: {
          base_char: string
          meaning_en: string
          meaning_id: string
          name_ja: string
          source?: string
        }
        Update: {
          base_char?: string
          meaning_en?: string
          meaning_id?: string
          name_ja?: string
          source?: string
        }
        Relationships: []
      }
      kanji_relations: {
        Row: {
          id: string
          kanji_id: string
          note_id: string | null
          related_kanji_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          kanji_id: string
          note_id?: string | null
          related_kanji_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          kanji_id?: string
          note_id?: string | null
          related_kanji_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kanji_relations_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: false
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanji_relations_related_kanji_id_fkey"
            columns: ["related_kanji_id"]
            isOneToOne: false
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
        ]
      }
      kanji_structure: {
        Row: {
          components: string[]
          created_at: string
          decomposition: Json
          kanji_id: string
          needs_review: boolean
          radical_base: string
          radical_form: string
          radical_kd2_base: string | null
          radical_position: string | null
          radical_rule: string | null
          radical_status: string
          source: string
        }
        Insert: {
          components?: string[]
          created_at?: string
          decomposition?: Json
          kanji_id: string
          needs_review?: boolean
          radical_base: string
          radical_form: string
          radical_kd2_base?: string | null
          radical_position?: string | null
          radical_rule?: string | null
          radical_status?: string
          source?: string
        }
        Update: {
          components?: string[]
          created_at?: string
          decomposition?: Json
          kanji_id?: string
          needs_review?: boolean
          radical_base?: string
          radical_form?: string
          radical_kd2_base?: string | null
          radical_position?: string | null
          radical_rule?: string | null
          radical_status?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanji_structure_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: true
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanji_structure_radical_base_fkey"
            columns: ["radical_base"]
            isOneToOne: false
            referencedRelation: "kanji_radicals"
            referencedColumns: ["base_char"]
          },
          {
            foreignKeyName: "kanji_structure_radical_form_fkey"
            columns: ["radical_form"]
            isOneToOne: false
            referencedRelation: "kanji_radical_forms"
            referencedColumns: ["form_char"]
          },
          {
            foreignKeyName: "kanji_structure_radical_kd2_base_fkey"
            columns: ["radical_kd2_base"]
            isOneToOne: false
            referencedRelation: "kanji_radicals"
            referencedColumns: ["base_char"]
          },
        ]
      }
      kanji_vocabulary_examples: {
        Row: {
          created_at: string
          id: string
          kanji_id: string
          sort_order: number
          vocabulary_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kanji_id: string
          sort_order?: number
          vocabulary_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kanji_id?: string
          sort_order?: number
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanji_vocabulary_examples_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: false
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanji_vocabulary_examples_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity: {
        Row: {
          activity_type: string
          created_at: string
          id: number
          metadata: Json
          points: number
          user_id: string
          xp: number
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: number
          metadata?: Json
          points?: number
          user_id: string
          xp?: number
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: number
          metadata?: Json
          points?: number
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      listening_items: {
        Row: {
          audio_attribution: string | null
          audio_license: string | null
          audio_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_published: boolean
          lesson_number: number | null
          lesson_title: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          question_type: string | null
          sort_order: number
          source: string | null
          source_book: string | null
          title: string
          transcript_en: string | null
          transcript_jp: string | null
          translation_id: string | null
        }
        Insert: {
          audio_attribution?: string | null
          audio_license?: string | null
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          question_type?: string | null
          sort_order?: number
          source?: string | null
          source_book?: string | null
          title: string
          transcript_en?: string | null
          transcript_jp?: string | null
          translation_id?: string | null
        }
        Update: {
          audio_attribution?: string | null
          audio_license?: string | null
          audio_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          question_type?: string | null
          sort_order?: number
          source?: string | null
          source_book?: string | null
          title?: string
          transcript_en?: string | null
          transcript_jp?: string | null
          translation_id?: string | null
        }
        Relationships: []
      }
      media_library: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          media_type: string
          mime_type: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          media_type: string
          mime_type?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          media_type?: string
          mime_type?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      memory_state: {
        Row: {
          aspect: string
          created_at: string
          direction: string
          due_at: string
          failure_count: number
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          lapses: number
          last_confidence: string | null
          last_error_type: string | null
          last_tested_at: string | null
          overconfident_wrong: number
          stability: number
          stage: number
          success_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect: string
          created_at?: string
          direction: string
          due_at?: string
          failure_count?: number
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          lapses?: number
          last_confidence?: string | null
          last_error_type?: string | null
          last_tested_at?: string | null
          overconfident_wrong?: number
          stability?: number
          stage?: number
          success_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect?: string
          created_at?: string
          direction?: string
          due_at?: string
          failure_count?: number
          item_id?: string
          item_type?: Database["public"]["Enums"]["content_skill"]
          lapses?: number
          last_confidence?: string | null
          last_error_type?: string | null
          last_tested_at?: string | null
          overconfident_wrong?: number
          stability?: number
          stage?: number
          success_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          amount_idr: number
          created_at: string
          currency: string
          duration_days: number | null
          id: string
          merchant_order_id: string
          paid_at: string | null
          plan: string | null
          product_id: string | null
          product_type: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_idr: number
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          merchant_order_id: string
          paid_at?: string | null
          plan?: string | null
          product_id?: string | null
          product_type: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_idr?: number
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          merchant_order_id?: string
          paid_at?: string | null
          plan?: string | null
          product_id?: string | null
          product_type?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_key: string
          id: string
          merchant_order_id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          event_key: string
          id?: string
          merchant_order_id: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status: string
        }
        Update: {
          created_at?: string
          event_key?: string
          id?: string
          merchant_order_id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      permission_registry: {
        Row: {
          created_at: string
          description: string | null
          key: string
          module: string
          name: string
          risk: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          module: string
          name: string
          risk?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          module?: string
          name?: string
          risk?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      point_redemptions: {
        Row: {
          created_at: string
          id: string
          points_spent: number
          reward_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_spent: number
          reward_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_spent?: number
          reward_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_note: string | null
          app_role_id: string | null
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          focus_mode: boolean
          id: string
          onboarding_completed: boolean
          plan: string
          premium_until: string | null
          referral_code: string | null
          referral_points: number
          role: string
          suspended_at: string | null
          target_level: Database["public"]["Enums"]["jlpt_level"] | null
          ui_language: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          app_role_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          focus_mode?: boolean
          id: string
          onboarding_completed?: boolean
          plan?: string
          premium_until?: string | null
          referral_code?: string | null
          referral_points?: number
          role?: string
          suspended_at?: string | null
          target_level?: Database["public"]["Enums"]["jlpt_level"] | null
          ui_language?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          app_role_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          focus_mode?: boolean
          id?: string
          onboarding_completed?: boolean
          plan?: string
          premium_until?: string | null
          referral_code?: string | null
          referral_points?: number
          role?: string
          suspended_at?: string | null
          target_level?: Database["public"]["Enums"]["jlpt_level"] | null
          ui_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_app_role_id_fkey"
            columns: ["app_role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          choices: Json
          choices_en: Json | null
          choices_id: Json | null
          correct_index: number
          created_at: string
          explanation_en: string | null
          explanation_id: string | null
          grammar_id: string | null
          id: string
          is_published: boolean
          kanji_id: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          listening_id: string | null
          passage_id: string | null
          prompt: string
          prompt_en: string | null
          prompt_id: string | null
          prompt_note: string | null
          question_type: string | null
          skill: Database["public"]["Enums"]["content_skill"]
          source: string | null
          vocabulary_id: string | null
        }
        Insert: {
          choices?: Json
          choices_en?: Json | null
          choices_id?: Json | null
          correct_index: number
          created_at?: string
          explanation_en?: string | null
          explanation_id?: string | null
          grammar_id?: string | null
          id?: string
          is_published?: boolean
          kanji_id?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          listening_id?: string | null
          passage_id?: string | null
          prompt: string
          prompt_en?: string | null
          prompt_id?: string | null
          prompt_note?: string | null
          question_type?: string | null
          skill: Database["public"]["Enums"]["content_skill"]
          source?: string | null
          vocabulary_id?: string | null
        }
        Update: {
          choices?: Json
          choices_en?: Json | null
          choices_id?: Json | null
          correct_index?: number
          created_at?: string
          explanation_en?: string | null
          explanation_id?: string | null
          grammar_id?: string | null
          id?: string
          is_published?: boolean
          kanji_id?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          listening_id?: string | null
          passage_id?: string | null
          prompt?: string
          prompt_en?: string | null
          prompt_id?: string | null
          prompt_note?: string | null
          question_type?: string | null
          skill?: Database["public"]["Enums"]["content_skill"]
          source?: string | null
          vocabulary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_grammar_id_fkey"
            columns: ["grammar_id"]
            isOneToOne: false
            referencedRelation: "grammar_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_kanji_id_fkey"
            columns: ["kanji_id"]
            isOneToOne: false
            referencedRelation: "kanji"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_listening_id_fkey"
            columns: ["listening_id"]
            isOneToOne: false
            referencedRelation: "listening_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_index: number
          user_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_index: number
          user_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          attempt_kind: string
          completed_at: string
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          level: Database["public"]["Enums"]["jlpt_level"] | null
          quiz_id: string | null
          score: number
          skill: Database["public"]["Enums"]["content_skill"] | null
          total_questions: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          attempt_kind?: string
          completed_at?: string
          correct_count: number
          created_at?: string
          duration_seconds?: number
          id?: string
          level?: Database["public"]["Enums"]["jlpt_level"] | null
          quiz_id?: string | null
          score?: number
          skill?: Database["public"]["Enums"]["content_skill"] | null
          total_questions: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          attempt_kind?: string
          completed_at?: string
          correct_count?: number
          created_at?: string
          duration_seconds?: number
          id?: string
          level?: Database["public"]["Enums"]["jlpt_level"] | null
          quiz_id?: string | null
          score?: number
          skill?: Database["public"]["Enums"]["content_skill"] | null
          total_questions?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_error_reviews: {
        Row: {
          created_at: string
          id: string
          last_wrong_at: string
          level: string
          question_id: string
          resolved_at: string | null
          skill: string | null
          user_id: string
          wrong_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_wrong_at?: string
          level: string
          question_id: string
          resolved_at?: string | null
          skill?: string | null
          user_id: string
          wrong_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_wrong_at?: string
          level?: string
          question_id?: string
          resolved_at?: string | null
          skill?: string | null
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_error_reviews_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          question_id: string
          quiz_id: string
          sort_order: number
        }
        Insert: {
          question_id: string
          quiz_id: string
          sort_order?: number
        }
        Update: {
          question_id?: string
          quiz_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          level: Database["public"]["Enums"]["jlpt_level"]
          question_count: number
          skill: Database["public"]["Enums"]["content_skill"] | null
          slug: string
          sort_order: number
          time_limit_seconds: number | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          level: Database["public"]["Enums"]["jlpt_level"]
          question_count?: number
          skill?: Database["public"]["Enums"]["content_skill"] | null
          slug: string
          sort_order?: number
          time_limit_seconds?: number | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          level?: Database["public"]["Enums"]["jlpt_level"]
          question_count?: number
          skill?: Database["public"]["Enums"]["content_skill"] | null
          slug?: string
          sort_order?: number
          time_limit_seconds?: number | null
          title?: string
        }
        Relationships: []
      }
      reading_curriculum: {
        Row: {
          created_at: string
          id: string
          lesson_number: number
          level: Database["public"]["Enums"]["jlpt_level"]
          sort_order: number
          source_book: string
          source_page: number | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_number: number
          level: Database["public"]["Enums"]["jlpt_level"]
          sort_order?: number
          source_book: string
          source_page?: number | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_number?: number
          level?: Database["public"]["Enums"]["jlpt_level"]
          sort_order?: number
          source_book?: string
          source_page?: number | null
          title?: string
        }
        Relationships: []
      }
      reading_passages: {
        Row: {
          body_furigana: string | null
          body_jp: string
          created_at: string
          estimated_minutes: number | null
          id: string
          is_published: boolean
          lesson_number: number | null
          lesson_title: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          sort_order: number
          source_book: string | null
          title: string
          translation_en: string | null
          translation_id: string | null
        }
        Insert: {
          body_furigana?: string | null
          body_jp: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          sort_order?: number
          source_book?: string | null
          title: string
          translation_en?: string | null
          translation_id?: string | null
        }
        Update: {
          body_furigana?: string | null
          body_jp?: string
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          sort_order?: number
          source_book?: string | null
          title?: string
          translation_en?: string | null
          translation_id?: string | null
        }
        Relationships: []
      }
      reading_vocabulary_annotations: {
        Row: {
          created_at: string
          id: string
          meaning_id: string | null
          passage_id: string
          position_order: number
          reading: string | null
          romaji: string | null
          source_type: string
          surface: string
          vocabulary_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meaning_id?: string | null
          passage_id: string
          position_order?: number
          reading?: string | null
          romaji?: string | null
          source_type?: string
          surface: string
          vocabulary_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meaning_id?: string | null
          passage_id?: string
          position_order?: number
          reading?: string | null
          romaji?: string | null
          source_type?: string
          surface?: string
          vocabulary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_vocabulary_annotations_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_vocabulary_annotations_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          points_awarded: number
          referral_code: string
          referred_user_id: string | null
          referrer_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          points_awarded?: number
          referral_code: string
          referred_user_id?: string | null
          referrer_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          points_awarded?: number
          referral_code?: string
          referred_user_id?: string | null
          referrer_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          points_awarded: number
          referred_user_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          points_awarded?: number
          referred_user_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          points_awarded?: number
          referred_user_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      reward_grants: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          points_spent: number
          premium_days: number
          reward_kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          points_spent?: number
          premium_days?: number
          reward_kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          points_spent?: number
          premium_days?: number
          reward_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          granted: boolean
          permission_key: string
          role_id: string
          scope: string
        }
        Insert: {
          granted?: boolean
          permission_key: string
          role_id: string
          scope?: string
        }
        Update: {
          granted?: boolean
          permission_key?: string
          role_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_registry"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      social_dm_mutes: {
        Row: {
          created_at: string
          other_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          other_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          other_id?: string
          user_id?: string
        }
        Relationships: []
      }
      social_friendships: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          responded_at: string | null
          status: string
          user_high: string
          user_low: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          responded_at?: string | null
          status?: string
          user_high: string
          user_low: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          responded_at?: string | null
          status?: string
          user_high?: string
          user_low?: string
        }
        Relationships: []
      }
      social_global_config: {
        Row: {
          id: number
          pinned_at: string | null
          pinned_by: string | null
          pinned_text: string | null
          slow_mode_seconds: number
          updated_at: string
        }
        Insert: {
          id?: number
          pinned_at?: string | null
          pinned_by?: string | null
          pinned_text?: string | null
          slow_mode_seconds?: number
          updated_at?: string
        }
        Update: {
          id?: number
          pinned_at?: string | null
          pinned_by?: string | null
          pinned_text?: string | null
          slow_mode_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      social_global_read: {
        Row: {
          last_read_at: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_moderation_terms: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: number
          language: string
          match_type: string
          severity: number
          term: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: never
          language?: string
          match_type?: string
          severity?: number
          term: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: never
          language?: string
          match_type?: string
          severity?: number
          term?: string
        }
        Relationships: []
      }
      social_profiles: {
        Row: {
          avatar_id: number
          created_at: string
          display_name: string | null
          user_id: string
          username: string
        }
        Insert: {
          avatar_id?: number
          created_at?: string
          display_name?: string | null
          user_id: string
          username: string
        }
        Update: {
          avatar_id?: number
          created_at?: string
          display_name?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      social_request_log: {
        Row: {
          created_at: string
          id: number
          requester_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          requester_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: never
          requester_id?: string
          target_id?: string
        }
        Relationships: []
      }
      social_settings: {
        Row: {
          allow_friend_requests: boolean
          dm_policy: string
          show_country: boolean
          show_jlpt: boolean
          show_online: boolean
          show_xp: boolean
          social_suspended_at: string | null
          social_suspended_reason: string | null
          sound_enabled: boolean
          updated_at: string
          user_id: string
          username_changed_at: string | null
        }
        Insert: {
          allow_friend_requests?: boolean
          dm_policy?: string
          show_country?: boolean
          show_jlpt?: boolean
          show_online?: boolean
          show_xp?: boolean
          social_suspended_at?: string | null
          social_suspended_reason?: string | null
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
          username_changed_at?: string | null
        }
        Update: {
          allow_friend_requests?: boolean
          dm_policy?: string
          show_country?: boolean
          show_jlpt?: boolean
          show_online?: boolean
          show_xp?: boolean
          social_suspended_at?: string | null
          social_suspended_reason?: string | null
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
          username_changed_at?: string | null
        }
        Relationships: []
      }
      social_username_history: {
        Row: {
          changed_at: string
          id: number
          new_username: string
          old_username: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: never
          new_username: string
          old_username: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: never
          new_username?: string
          old_username?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          created_at: string
          daily_minutes: number
          id: string
          preferred_new_grammar: number
          preferred_new_kanji: number
          preferred_new_vocabulary: number
          preferred_quiz: number
          preferred_review: number
          start_date: string
          status: string
          study_days_per_week: number
          target_date: string
          target_level: Database["public"]["Enums"]["jlpt_level"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_minutes?: number
          id?: string
          preferred_new_grammar?: number
          preferred_new_kanji?: number
          preferred_new_vocabulary?: number
          preferred_quiz?: number
          preferred_review?: number
          start_date?: string
          status?: string
          study_days_per_week?: number
          target_date: string
          target_level: Database["public"]["Enums"]["jlpt_level"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_minutes?: number
          id?: string
          preferred_new_grammar?: number
          preferred_new_kanji?: number
          preferred_new_vocabulary?: number
          preferred_quiz?: number
          preferred_review?: number
          start_date?: string
          status?: string
          study_days_per_week?: number
          target_date?: string
          target_level?: Database["public"]["Enums"]["jlpt_level"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          active_seconds: number
          created_at: string
          ended_at: string | null
          id: string
          metadata: Json
          source: string
          started_at: string
          user_id: string
        }
        Insert: {
          active_seconds?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          source?: string
          started_at?: string
          user_id: string
        }
        Update: {
          active_seconds?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          source?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number | null
          id: string
          is_active: boolean
          lifetime: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          lifetime?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          lifetime?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      teacher_class_enrollments: {
        Row: {
          amount_jpy: number
          class_id: string
          enrolled_at: string
          id: string
          payment_status: string
          student_id: string
        }
        Insert: {
          amount_jpy?: number
          class_id: string
          enrolled_at?: string
          id?: string
          payment_status?: string
          student_id: string
        }
        Update: {
          amount_jpy?: number
          class_id?: string
          enrolled_at?: string
          id?: string
          payment_status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          admin_note: string | null
          banner_url: string | null
          capacity: number | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          level: Database["public"]["Enums"]["jlpt_level"] | null
          price_jpy: number
          slug: string
          starts_at: string | null
          status: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          banner_url?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["jlpt_level"] | null
          price_jpy?: number
          slug: string
          starts_at?: string | null
          status?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          banner_url?: string | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          level?: Database["public"]["Enums"]["jlpt_level"] | null
          price_jpy?: number
          slug?: string
          starts_at?: string | null
          status?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          claimed_at: string | null
          created_at: string
          duration_days: number | null
          email: string
          id: string
          invited_by: string
          plan: string
          role: string
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          duration_days?: number | null
          email: string
          id?: string
          invited_by: string
          plan?: string
          role?: string
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          duration_days?: number | null
          email?: string
          id?: string
          invited_by?: string
          plan?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      user_item_progress: {
        Row: {
          created_at: string
          due_at: string | null
          ease_factor: number
          id: string
          interval_days: number
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          last_reviewed_at: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          repetitions: number
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          ease_factor?: number
          id?: string
          interval_days?: number
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          last_reviewed_at?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          repetitions?: number
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          ease_factor?: number
          id?: string
          interval_days?: number
          item_id?: string
          item_type?: Database["public"]["Enums"]["content_skill"]
          last_reviewed_at?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          repetitions?: number
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_learning_stats: {
        Row: {
          avatar_url: string | null
          correct_answers: number
          current_streak: number
          display_name: string | null
          jlpt_level: string
          last_activity_at: string | null
          lessons_completed: number
          longest_streak: number
          quizzes_completed: number
          study_minutes: number
          total_answers: number
          total_points: number
          ui_language: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          correct_answers?: number
          current_streak?: number
          display_name?: string | null
          jlpt_level?: string
          last_activity_at?: string | null
          lessons_completed?: number
          longest_streak?: number
          quizzes_completed?: number
          study_minutes?: number
          total_answers?: number
          total_points?: number
          ui_language?: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          correct_answers?: number
          current_streak?: number
          display_name?: string | null
          jlpt_level?: string
          last_activity_at?: string | null
          lessons_completed?: number
          longest_streak?: number
          quizzes_completed?: number
          study_minutes?: number
          total_answers?: number
          total_points?: number
          ui_language?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          daily_grammar_target: number
          daily_kanji_target: number
          daily_reminder: boolean
          daily_vocab_target: number
          furigana_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_grammar_target?: number
          daily_kanji_target?: number
          daily_reminder?: boolean
          daily_vocab_target?: number
          furigana_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_grammar_target?: number
          daily_kanji_target?: number
          daily_reminder?: boolean
          daily_vocab_target?: number
          furigana_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string
          current_streak: number
          last_activity_date: string | null
          longest_streak: number
          reward_points: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          reward_points?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          reward_points?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verb_form_types: {
        Row: {
          category: string
          form_code: string
          is_active: boolean
          label_id: string
          label_ja: string
          sort_order: number
        }
        Insert: {
          category?: string
          form_code: string
          is_active?: boolean
          label_id: string
          label_ja: string
          sort_order: number
        }
        Update: {
          category?: string
          form_code?: string
          is_active?: boolean
          label_id?: string
          label_ja?: string
          sort_order?: number
        }
        Relationships: []
      }
      verb_forms: {
        Row: {
          created_at: string
          form_code: string
          form_id: string | null
          form_ja: string | null
          id: string
          polarity: string | null
          politeness: string | null
          provenance: string
          reading: string | null
          source_book: string | null
          source_reference: string | null
          tense: string | null
          updated_at: string
          value: string
          vocabulary_id: string
          voice: string | null
        }
        Insert: {
          created_at?: string
          form_code: string
          form_id?: string | null
          form_ja?: string | null
          id?: string
          polarity?: string | null
          politeness?: string | null
          provenance?: string
          reading?: string | null
          source_book?: string | null
          source_reference?: string | null
          tense?: string | null
          updated_at?: string
          value: string
          vocabulary_id: string
          voice?: string | null
        }
        Update: {
          created_at?: string
          form_code?: string
          form_id?: string | null
          form_ja?: string | null
          id?: string
          polarity?: string | null
          politeness?: string | null
          provenance?: string
          reading?: string | null
          source_book?: string | null
          source_reference?: string | null
          tense?: string | null
          updated_at?: string
          value?: string
          vocabulary_id?: string
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verb_forms_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      verb_pairs: {
        Row: {
          created_at: string
          id: string
          intransitive_meaning_id: string | null
          intransitive_reading: string | null
          intransitive_term: string
          intransitive_vocabulary_id: string | null
          source_book: string
          source_order: number | null
          transitive_meaning_id: string | null
          transitive_reading: string | null
          transitive_term: string
          transitive_vocabulary_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intransitive_meaning_id?: string | null
          intransitive_reading?: string | null
          intransitive_term: string
          intransitive_vocabulary_id?: string | null
          source_book: string
          source_order?: number | null
          transitive_meaning_id?: string | null
          transitive_reading?: string | null
          transitive_term: string
          transitive_vocabulary_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intransitive_meaning_id?: string | null
          intransitive_reading?: string | null
          intransitive_term?: string
          intransitive_vocabulary_id?: string | null
          source_book?: string
          source_order?: number | null
          transitive_meaning_id?: string | null
          transitive_reading?: string | null
          transitive_term?: string
          transitive_vocabulary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verb_pairs_intransitive_vocabulary_id_fkey"
            columns: ["intransitive_vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verb_pairs_transitive_vocabulary_id_fkey"
            columns: ["transitive_vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary: {
        Row: {
          created_at: string
          examples: Json
          id: string
          is_published: boolean
          lesson_number: number | null
          lesson_title: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string | null
          meaning_id: string
          part_of_speech: string | null
          reading: string | null
          romaji: string | null
          sort_order: number
          source_book: string | null
          term: string
          usage_note_id: string | null
        }
        Insert: {
          created_at?: string
          examples?: Json
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en?: string | null
          meaning_id: string
          part_of_speech?: string | null
          reading?: string | null
          romaji?: string | null
          sort_order?: number
          source_book?: string | null
          term: string
          usage_note_id?: string | null
        }
        Update: {
          created_at?: string
          examples?: Json
          id?: string
          is_published?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level?: Database["public"]["Enums"]["jlpt_level"]
          meaning_en?: string | null
          meaning_id?: string
          part_of_speech?: string | null
          reading?: string | null
          romaji?: string | null
          sort_order?: number
          source_book?: string | null
          term?: string
          usage_note_id?: string | null
        }
        Relationships: []
      }
      vocabulary_batch_runs: {
        Row: {
          categorized: number
          error_text: string | null
          finished_at: string | null
          id: string
          inserted_new: number
          linked_existing: number
          pending_after: number | null
          processed: number
          started_at: string
          status: string
          verb_pairs_linked: number
        }
        Insert: {
          categorized?: number
          error_text?: string | null
          finished_at?: string | null
          id?: string
          inserted_new?: number
          linked_existing?: number
          pending_after?: number | null
          processed?: number
          started_at?: string
          status?: string
          verb_pairs_linked?: number
        }
        Update: {
          categorized?: number
          error_text?: string | null
          finished_at?: string | null
          id?: string
          inserted_new?: number
          linked_existing?: number
          pending_after?: number | null
          processed?: number
          started_at?: string
          status?: string
          verb_pairs_linked?: number
        }
        Relationships: []
      }
      vocabulary_categories: {
        Row: {
          canonical_slug: string | null
          created_at: string
          id: string
          is_active: boolean
          label_id: string | null
          label_ja: string | null
          name_id: string
          parent_slug: string | null
          slug: string
          sort_order: number
          taxonomy_kind: string
        }
        Insert: {
          canonical_slug?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label_id?: string | null
          label_ja?: string | null
          name_id: string
          parent_slug?: string | null
          slug: string
          sort_order?: number
          taxonomy_kind?: string
        }
        Update: {
          canonical_slug?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label_id?: string | null
          label_ja?: string | null
          name_id?: string
          parent_slug?: string | null
          slug?: string
          sort_order?: number
          taxonomy_kind?: string
        }
        Relationships: []
      }
      vocabulary_category_links: {
        Row: {
          category_id: string
          confidence: string
          created_at: string
          mapping_method: string
          source_book: string | null
          source_reference: string | null
          vocabulary_id: string
        }
        Insert: {
          category_id: string
          confidence?: string
          created_at?: string
          mapping_method?: string
          source_book?: string | null
          source_reference?: string | null
          vocabulary_id: string
        }
        Update: {
          category_id?: string
          confidence?: string
          created_at?: string
          mapping_method?: string
          source_book?: string | null
          source_reference?: string | null
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_category_links_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_category_map: {
        Row: {
          category_slug: string
          created_at: string
          source_book: string | null
          vocabulary_id: string
        }
        Insert: {
          category_slug: string
          created_at?: string
          source_book?: string | null
          vocabulary_id: string
        }
        Update: {
          category_slug?: string
          created_at?: string
          source_book?: string | null
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_category_map_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "vocabulary_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "vocabulary_category_map_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_curriculum: {
        Row: {
          created_at: string
          display_lesson_number: number | null
          id: string
          lesson_number: number | null
          lesson_title: string | null
          mapping_confidence: string
          source_book: string
          source_kind: string
          source_meaning_id: string | null
          source_reading: string | null
          source_reference: string | null
          source_term: string | null
          source_unit_number: number | null
          source_unit_type: string | null
          vocabulary_id: string
        }
        Insert: {
          created_at?: string
          display_lesson_number?: number | null
          id?: string
          lesson_number?: number | null
          lesson_title?: string | null
          mapping_confidence?: string
          source_book: string
          source_kind?: string
          source_meaning_id?: string | null
          source_reading?: string | null
          source_reference?: string | null
          source_term?: string | null
          source_unit_number?: number | null
          source_unit_type?: string | null
          vocabulary_id: string
        }
        Update: {
          created_at?: string
          display_lesson_number?: number | null
          id?: string
          lesson_number?: number | null
          lesson_title?: string | null
          mapping_confidence?: string
          source_book?: string
          source_kind?: string
          source_meaning_id?: string | null
          source_reading?: string | null
          source_reference?: string | null
          source_term?: string | null
          source_unit_number?: number | null
          source_unit_type?: string | null
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_curriculum_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_level_labels: {
        Row: {
          created_at: string
          level: Database["public"]["Enums"]["jlpt_level"]
          vocabulary_id: string
        }
        Insert: {
          created_at?: string
          level: Database["public"]["Enums"]["jlpt_level"]
          vocabulary_id: string
        }
        Update: {
          created_at?: string
          level?: Database["public"]["Enums"]["jlpt_level"]
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_level_labels_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_merge_map: {
        Row: {
          canonical_id: string
          created_at: string
          duplicate_id: string
          reason: string
        }
        Insert: {
          canonical_id: string
          created_at?: string
          duplicate_id: string
          reason?: string
        }
        Update: {
          canonical_id?: string
          created_at?: string
          duplicate_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_merge_map_canonical_id_fkey"
            columns: ["canonical_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_merge_map_duplicate_id_fkey"
            columns: ["duplicate_id"]
            isOneToOne: true
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_relations: {
        Row: {
          confidence: string
          created_at: string
          id: string
          relation_type: string
          source_book: string | null
          source_reference: string | null
          source_vocabulary_id: string
          target_vocabulary_id: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          id?: string
          relation_type: string
          source_book?: string | null
          source_reference?: string | null
          source_vocabulary_id: string
          target_vocabulary_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          id?: string
          relation_type?: string
          source_book?: string | null
          source_reference?: string | null
          source_vocabulary_id?: string
          target_vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_relations_source_vocabulary_id_fkey"
            columns: ["source_vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_relations_target_vocabulary_id_fkey"
            columns: ["target_vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_senses: {
        Row: {
          created_at: string
          examples: Json
          id: string
          meaning_id: string
          part_of_speech: string | null
          source_book: string | null
          usage_note_id: string | null
          vocabulary_id: string
        }
        Insert: {
          created_at?: string
          examples?: Json
          id?: string
          meaning_id: string
          part_of_speech?: string | null
          source_book?: string | null
          usage_note_id?: string | null
          vocabulary_id: string
        }
        Update: {
          created_at?: string
          examples?: Json
          id?: string
          meaning_id?: string
          part_of_speech?: string | null
          source_book?: string | null
          usage_note_id?: string | null
          vocabulary_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_senses_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_source_items: {
        Row: {
          accent: string | null
          created_at: string
          id: string
          is_expression: boolean
          is_reference: boolean
          is_verified: boolean
          lesson_number: number | null
          lesson_title: string | null
          level_hint: Database["public"]["Enums"]["jlpt_level"] | null
          lexical_class: string | null
          meaning_id: string
          reading: string | null
          source_book: string
          source_order: number | null
          source_section: string | null
          subgroup: string | null
          term: string
          verb_group: number | null
          vocabulary_id: string | null
        }
        Insert: {
          accent?: string | null
          created_at?: string
          id?: string
          is_expression?: boolean
          is_reference?: boolean
          is_verified?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level_hint?: Database["public"]["Enums"]["jlpt_level"] | null
          lexical_class?: string | null
          meaning_id: string
          reading?: string | null
          source_book: string
          source_order?: number | null
          source_section?: string | null
          subgroup?: string | null
          term: string
          verb_group?: number | null
          vocabulary_id?: string | null
        }
        Update: {
          accent?: string | null
          created_at?: string
          id?: string
          is_expression?: boolean
          is_reference?: boolean
          is_verified?: boolean
          lesson_number?: number | null
          lesson_title?: string | null
          level_hint?: Database["public"]["Enums"]["jlpt_level"] | null
          lexical_class?: string | null
          meaning_id?: string
          reading?: string | null
          source_book?: string
          source_order?: number | null
          source_section?: string | null
          subgroup?: string | null
          term?: string
          verb_group?: number | null
          vocabulary_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_source_items_vocabulary_id_fkey"
            columns: ["vocabulary_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      jlpt_simulation_questions_public: {
        Row: {
          audio_url: string | null
          choices: Json | null
          display_question_no: number | null
          id: string | null
          image_url: string | null
          instruction_jp: string | null
          level: string | null
          mondai_no: number | null
          passage_jp: string | null
          passage_title: string | null
          prompt_jp: string | null
          question_no: number | null
          question_type: string | null
          section: string | null
          transcript_jp: string | null
        }
        Insert: {
          audio_url?: string | null
          choices?: Json | null
          display_question_no?: number | null
          id?: string | null
          image_url?: string | null
          instruction_jp?: string | null
          level?: string | null
          mondai_no?: number | null
          passage_jp?: string | null
          passage_title?: string | null
          prompt_jp?: string | null
          question_no?: number | null
          question_type?: string | null
          section?: string | null
          transcript_jp?: string | null
        }
        Update: {
          audio_url?: string | null
          choices?: Json | null
          display_question_no?: number | null
          id?: string | null
          image_url?: string | null
          instruction_jp?: string | null
          level?: string | null
          mondai_no?: number | null
          passage_jp?: string | null
          passage_title?: string | null
          prompt_jp?: string | null
          question_no?: number | null
          question_type?: string | null
          section?: string | null
          transcript_jp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_digital_product_purchase: {
        Args: { p_payment_order_id: string }
        Returns: undefined
      }
      admin_assign_app_role: {
        Args: { p_role_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_audit_content_save: {
        Args: { p_created: boolean; p_id: string; p_kind: string }
        Returns: undefined
      }
      admin_create_announcement: {
        Args: { p_audience?: string; p_body: string; p_title: string }
        Returns: Json
      }
      admin_delete_content_item: {
        Args: { p_id: string; p_kind: string }
        Returns: undefined
      }
      admin_delete_media: { Args: { p_id: string }; Returns: undefined }
      admin_get_content_item: {
        Args: { p_id: string; p_kind: string }
        Returns: Json
      }
      admin_invite_user: {
        Args: {
          p_duration_days?: number
          p_email: string
          p_plan?: string
          p_role?: string
        }
        Returns: string
      }
      admin_list_announcements: { Args: { p_limit?: number }; Returns: Json }
      admin_list_media: { Args: { p_limit?: number }; Returns: Json }
      admin_list_reports: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      admin_log_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      admin_register_media: {
        Args: {
          p_media_type: string
          p_mime_type?: string
          p_title: string
          p_url: string
        }
        Returns: string
      }
      admin_review_teacher_class: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      admin_save_content_item: {
        Args: { p_data: Json; p_id: string; p_kind: string }
        Returns: string
      }
      admin_save_platform_settings: {
        Args: { p_settings: Json }
        Returns: undefined
      }
      admin_save_question_item: {
        Args: { p_data: Json; p_id: string }
        Returns: string
      }
      admin_save_role: {
        Args: {
          p_description: string
          p_id: string
          p_is_active?: boolean
          p_name: string
          p_permissions: Json
        }
        Returns: string
      }
      admin_set_content_published: {
        Args: { p_id: string; p_kind: string; p_published: boolean }
        Returns: Json
      }
      admin_set_user_free: { Args: { p_user_id: string }; Returns: undefined }
      admin_set_user_premium: {
        Args: { p_duration_days: number; p_user_id: string }
        Returns: Json
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_user_suspended: {
        Args: { p_note?: string; p_suspended: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_update_report: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      admin_update_subscription_plan: {
        Args: { p_is_active?: boolean; p_plan_id: string; p_price?: number }
        Returns: Json
      }
      admin_update_user_access: {
        Args: { p_plan?: string; p_role?: string; p_user_id: string }
        Returns: Json
      }
      award_referral_signup: { Args: { p_code: string }; Returns: number }
      can_download_digital_product: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      can_manage_class: { Args: { p_class_id: string }; Returns: boolean }
      can_start_full_simulation: { Args: never; Returns: Json }
      complete_jlpt_simulation_full: {
        Args: { p_passed: boolean; p_session_id: string; p_total_score: number }
        Returns: {
          certificate_token: string
          completed_at: string
          session_id: string
        }[]
      }
      create_digital_product_order: {
        Args: { p_delivery_email: string; p_product_id: string }
        Returns: Json
      }
      create_or_replace_study_plan: {
        Args: {
          p_daily_minutes?: number
          p_study_days?: number
          p_target_date: string
          p_target_level: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: {
          created_at: string
          daily_minutes: number
          id: string
          preferred_new_grammar: number
          preferred_new_kanji: number
          preferred_new_vocabulary: number
          preferred_quiz: number
          preferred_review: number
          start_date: string
          status: string
          study_days_per_week: number
          target_date: string
          target_level: Database["public"]["Enums"]["jlpt_level"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_role: { Args: never; Returns: string }
      delete_admin_announcement: { Args: { p_id: string }; Returns: undefined }
      delete_my_notification: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      delete_my_read_notifications: { Args: never; Returns: number }
      dm_conversation_hide: { Args: { p_with: string }; Returns: Json }
      dm_conversation_list: { Args: never; Returns: Json }
      dm_delete_message: { Args: { p_id: string }; Returns: Json }
      dm_edit_message: { Args: { p_body: string; p_id: string }; Returns: Json }
      dm_history: {
        Args: {
          p_before_at?: string
          p_before_id?: string
          p_limit?: number
          p_with: string
        }
        Returns: Json
      }
      dm_mark_read: { Args: { p_with: string }; Returns: Json }
      dm_send: {
        Args: { p_body: string; p_reply_to?: string; p_to: string }
        Returns: Json
      }
      dm_send_message: {
        Args: {
          p_body: string
          p_client_id?: string
          p_reply_to?: string
          p_to: string
        }
        Returns: Json
      }
      dm_set_mute: { Args: { p_muted: boolean; p_user: string }; Returns: Json }
      enroll_in_class: { Args: { p_class_id: string }; Returns: string }
      ensure_active_study_plan: {
        Args: never
        Returns: {
          created_at: string
          daily_minutes: number
          id: string
          preferred_new_grammar: number
          preferred_new_kanji: number
          preferred_new_vocabulary: number
          preferred_quiz: number
          preferred_review: number
          start_date: string
          status: string
          study_days_per_week: number
          target_date: string
          target_level: Database["public"]["Enums"]["jlpt_level"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_premium_accounts: { Args: never; Returns: number }
      finalize_duitku_payment: {
        Args: {
          p_event_key: string
          p_merchant_order_id: string
          p_payload: Json
          p_payment_method: string
          p_provider_reference: string
        }
        Returns: string
      }
      finalize_jlpt_simulation_full: {
        Args: { p_full_session_id: string }
        Returns: {
          certificate_token: string
          completed_at: string
          exam_no: number
          level: string
          passed: boolean
          session_id: string
          total_score: number
        }[]
      }
      friend_remove: { Args: { p_user: string }; Returns: Json }
      friend_request_cancel: { Args: { p_user: string }; Returns: Json }
      friend_request_respond: {
        Args: { p_accept: boolean; p_user: string }
        Returns: Json
      }
      friend_request_send: { Args: { p_username: string }; Returns: Json }
      generate_daily_study_tasks: {
        Args: { p_study_date?: string }
        Returns: {
          completed_at: string | null
          completed_count: number
          created_at: string
          id: string
          metadata: Json
          plan_id: string
          priority: number
          reason: string | null
          study_date: string
          target_count: number
          task_type: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_study_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_weekly_study_plan: {
        Args: { p_date?: string }
        Returns: {
          completed_at: string | null
          completed_count: number
          created_at: string
          id: string
          metadata: Json
          plan_id: string
          priority: number
          reason: string | null
          study_date: string
          target_count: number
          task_type: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_study_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_admin_action_queue: { Args: never; Returns: Json }
      get_admin_analytics:
        | { Args: never; Returns: Json }
        | { Args: { p_days?: number }; Returns: Json }
      get_admin_audit_events: {
        Args: {
          p_action?: string
          p_entity_type?: string
          p_limit?: number
          p_search?: string
        }
        Returns: {
          action: string
          actor_id: string
          actor_name: string
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          metadata: Json
        }[]
      }
      get_admin_console_data: {
        Args: { p_level?: string; p_section?: string }
        Returns: Json
      }
      get_admin_finance_overview: { Args: never; Returns: Json }
      get_admin_import_backups: {
        Args: never
        Returns: {
          content_type: string
          created_at: string
          id: string
          row_count: number
          source_file: string
        }[]
      }
      get_admin_import_jobs: {
        Args: never
        Returns: {
          actor_id: string
          content_type: string
          created_at: string
          errors: Json
          failed_rows: number
          file_name: string | null
          id: string
          mode: string
          skipped_rows: number
          status: string
          success_rows: number
          total_rows: number
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_import_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_admin_overview: { Args: never; Returns: Json }
      get_admin_subscription_plans: { Args: never; Returns: Json }
      get_admin_user_audit: { Args: { p_user_id: string }; Returns: Json }
      get_admin_users: { Args: never; Returns: Json }
      get_class_member_access: {
        Args: { p_class_id: string }
        Returns: {
          enrolled: boolean
          meeting_url: string
        }[]
      }
      get_class_quiz_for_student: {
        Args: { p_quiz_id: string }
        Returns: {
          choices: Json
          description: string
          due_at: string
          question: string
          question_id: string
          quiz_id: string
          sort_order: number
          title: string
        }[]
      }
      get_class_quiz_review: {
        Args: { p_attempt_id: string }
        Returns: {
          choices: Json
          correct_index: number
          explanation: string
          is_correct: boolean
          question: string
          question_id: string
          selected_index: number
        }[]
      }
      get_class_quizzes_for_student: {
        Args: { p_class_id: string }
        Returns: {
          attempt_count: number
          best_score: number
          created_at: string
          description: string
          due_at: string
          id: string
          title: string
        }[]
      }
      get_competition_leaderboard: {
        Args: { p_limit?: number; p_period?: string }
        Returns: {
          avatar_url: string
          current_streak: number
          display_name: string
          jlpt_level: string
          period_xp: number
          rank: number
          total_points: number
          total_xp: number
          user_id: string
        }[]
      }
      get_content_review_statuses: {
        Args: { p_ids: string[]; p_type: string }
        Returns: {
          content_id: string
          content_type: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "content_review_status"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_content_review_summary: { Args: never; Returns: Json }
      get_content_staff_access: { Args: never; Returns: Json }
      get_digital_product_finance: { Args: never; Returns: Json }
      get_eno_monthly_exam_admin: { Args: never; Returns: Json }
      get_eno_monthly_exam_questions: {
        Args: { p_attempt_id: string }
        Returns: {
          audio_url: string
          choices: Json
          id: string
          image_url: string
          instruction_jp: string
          mondai_no: number
          passage_jp: string
          prompt_jp: string
          question_no: number
          section: string
        }[]
      }
      get_eno_monthly_exam_ranking: {
        Args: { p_exam_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          duration_seconds: number
          rank: number
          score: number
          submitted_at: string
          user_id: string
        }[]
      }
      get_jlpt_simulation_attempt_review: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_jlpt_simulation_full_review: {
        Args: { p_full_session_id: string }
        Returns: Json
      }
      get_kanji_structure: {
        Args: {
          p_kanji_id: string
          p_level?: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: Json
      }
      get_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          correct_answers: number
          current_streak: number
          display_name: string
          jlpt_level: string
          last_activity_at: string
          lessons_completed: number
          longest_streak: number
          quizzes_completed: number
          rank: number
          study_minutes: number
          total_answers: number
          total_points: number
          user_id: string
          xp: number
        }[]
      }
      get_material_sync_status: { Args: { p_level?: string }; Returns: Json }
      get_my_class_grades: {
        Args: { p_class_id: string }
        Returns: {
          assignment_id: string
          assignment_title: string
          feedback: string
          id: string
          score: number
          updated_at: string
        }[]
      }
      get_my_class_quiz_attempts: {
        Args: { p_class_id: string }
        Returns: {
          correct_count: number
          id: string
          quiz_id: string
          quiz_title: string
          score: number
          submitted_at: string
          total_questions: number
        }[]
      }
      get_my_class_topic_insights: {
        Args: { p_class_id: string }
        Returns: {
          accuracy: number
          category: string
          correct_count: number
          topic: string
          total_questions: number
          user_id: string
        }[]
      }
      get_my_classes: {
        Args: never
        Returns: {
          banner_url: string
          class_mode: string
          enrollment_status: string
          id: string
          level: string
          meeting_url: string
          starts_at: string
          status: string
          title: string
        }[]
      }
      get_my_dashboard_metrics: { Args: never; Returns: Json }
      get_my_membership: { Args: never; Returns: Json }
      get_my_notification_settings: { Args: never; Returns: Json }
      get_operations_console: { Args: never; Returns: Json }
      get_platform_settings_admin: { Args: never; Returns: Json }
      get_public_class: {
        Args: { p_class_id: string }
        Returns: {
          banner_url: string
          capacity: number
          class_mode: string
          created_at: string
          currency: string
          description: string
          ends_at: string
          id: string
          level: string
          price: number
          slug: string
          starts_at: string
          status: string
          title: string
        }[]
      }
      get_public_class_enrollment_counts: {
        Args: never
        Returns: {
          class_id: string
          participant_count: number
        }[]
      }
      get_public_classes: {
        Args: never
        Returns: {
          banner_url: string
          capacity: number
          class_mode: string
          currency: string
          description: string
          ends_at: string
          id: string
          level: string
          price: number
          starts_at: string
          status: string
          title: string
        }[]
      }
      get_published_simulation_questions: {
        Args: { p_exam_no?: number; p_level: string; p_section: string }
        Returns: {
          audio_url: string
          choices: Json
          display_question_no: number
          id: string
          image_url: string
          instruction_jp: string
          mondai_no: number
          passage_jp: string
          passage_title: string
          prompt_jp: string
          question_no: number
          question_type: string
          target_occurrence: number
          target_text: string
          transcript_jp: string
        }[]
      }
      get_quiz_questions: {
        Args: {
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_limit?: number
          p_skill?: Database["public"]["Enums"]["content_skill"]
        }
        Returns: {
          choices: Json
          explanation_en: string
          explanation_id: string
          id: string
          level: Database["public"]["Enums"]["jlpt_level"]
          prompt: string
          skill: Database["public"]["Enums"]["content_skill"]
        }[]
      }
      get_role_permission_console: { Args: never; Returns: Json }
      get_simulation_exam_numbers: {
        Args: { p_level: string }
        Returns: number[]
      }
      get_system_console: { Args: never; Returns: Json }
      get_target_page_metrics: { Args: never; Returns: Json }
      get_teacher_class_participants: {
        Args: { p_class_id: string }
        Returns: {
          display_name: string
          joined_at: string
          status: string
          user_id: string
        }[]
      }
      get_teacher_class_question_insights: {
        Args: { p_class_id: string }
        Returns: {
          accuracy: number
          attempts_count: number
          correct_count: number
          display_name: string
          question: string
          question_id: string
          quiz_title: string
          user_id: string
        }[]
      }
      get_teacher_class_quiz_attempts: {
        Args: { p_class_id: string }
        Returns: {
          attempt_id: string
          correct_count: number
          display_name: string
          quiz_id: string
          quiz_title: string
          score: number
          submitted_at: string
          total_questions: number
          user_id: string
        }[]
      }
      get_teacher_class_submissions: {
        Args: { p_class_id: string }
        Returns: {
          answer_text: string
          assignment_id: string
          assignment_title: string
          attachment_url: string
          current_feedback: string
          current_score: number
          display_name: string
          id: string
          max_score: number
          status: string
          submitted_at: string
          user_id: string
        }[]
      }
      get_teacher_class_topic_insights: {
        Args: { p_class_id: string }
        Returns: {
          accuracy: number
          category: string
          correct_count: number
          topic: string
          total_questions: number
          user_id: string
        }[]
      }
      get_teacher_classes: { Args: never; Returns: Json }
      get_teacher_console_data: { Args: never; Returns: Json }
      get_teacher_content: {
        Args: { p_kind: string; p_level?: string }
        Returns: Json
      }
      get_teacher_quiz_attempts: {
        Args: { p_class_id: string }
        Returns: {
          correct_count: number
          display_name: string
          id: string
          quiz_id: string
          quiz_title: string
          score: number
          submitted_at: string
          total_questions: number
          user_id: string
        }[]
      }
      get_visible_eno_monthly_exams: {
        Args: never
        Returns: {
          attempts_used: number
          closes_at: string
          duration_minutes: number
          exam_month: string
          id: string
          is_entitled: boolean
          level: string
          opens_at: string
          passing_score: number
          premium_only: boolean
          status: string
          title: string
        }[]
      }
      get_vocabulary_category_counts: {
        Args: { p_level: Database["public"]["Enums"]["jlpt_level"] }
        Returns: {
          category_slug: string
          item_count: number
        }[]
      }
      get_vocabulary_count_by_category: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: number
      }
      get_vocabulary_count_by_level: {
        Args: { p_level: Database["public"]["Enums"]["jlpt_level"] }
        Returns: number
      }
      get_vocabulary_count_by_primary_category: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: number
      }
      get_vocabulary_count_by_subcategory: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_subcategory_slug: string
        }
        Returns: number
      }
      get_vocabulary_lesson_counts: {
        Args: { p_level: Database["public"]["Enums"]["jlpt_level"] }
        Returns: {
          lesson_number: number
          lesson_title: string
          word_count: number
        }[]
      }
      get_vocabulary_lexical_rows: {
        Args: { p_level: Database["public"]["Enums"]["jlpt_level"] }
        Returns: {
          component_order: number
          created_at: string
          examples: Json
          id: string
          lesson_number: number
          lesson_title: string
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string
          meaning_id: string
          origin_id: string
          part_of_speech: string
          reading: string
          romaji: string
          sort_order: number
          source_book: string
          term: string
          usage_note_id: string
        }[]
      }
      get_vocabulary_page_by_category: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          examples: Json
          id: string
          lesson_number: number
          lesson_title: string
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string
          meaning_id: string
          part_of_speech: string
          reading: string
          romaji: string
          sort_order: number
          source_book: string
          term: string
          usage_note_id: string
        }[]
      }
      get_vocabulary_page_by_lesson: {
        Args: {
          p_lesson: number
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          examples: Json
          id: string
          lesson_number: number
          lesson_title: string
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string
          meaning_id: string
          part_of_speech: string
          reading: string
          romaji: string
          sort_order: number
          source_book: string
          term: string
          usage_note_id: string
        }[]
      }
      get_vocabulary_page_by_level: {
        Args: {
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          examples: Json
          id: string
          lesson_number: number
          lesson_title: string
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string
          meaning_id: string
          part_of_speech: string
          reading: string
          romaji: string
          sort_order: number
          source_book: string
          term: string
          usage_note_id: string
        }[]
      }
      get_vocabulary_page_by_primary_category: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          examples: Json
          id: string
          lesson_number: number
          lesson_title: string
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string
          meaning_id: string
          part_of_speech: string
          reading: string
          romaji: string
          sort_order: number
          source_book: string
          term: string
          usage_note_id: string
        }[]
      }
      get_vocabulary_page_by_subcategory: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_limit?: number
          p_offset?: number
          p_subcategory_slug: string
        }
        Returns: {
          examples: Json
          id: string
          lesson_number: number
          lesson_title: string
          level: Database["public"]["Enums"]["jlpt_level"]
          meaning_en: string
          meaning_id: string
          part_of_speech: string
          reading: string
          romaji: string
          sort_order: number
          source_book: string
          term: string
          usage_note_id: string
        }[]
      }
      get_vocabulary_primary_category_counts: {
        Args: { p_level: Database["public"]["Enums"]["jlpt_level"] }
        Returns: {
          category_slug: string
          item_count: number
        }[]
      }
      get_vocabulary_subcategory_counts: {
        Args: {
          p_category_slug: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: {
          item_count: number
          subcategory_slug: string
        }[]
      }
      global_config: { Args: never; Returns: Json }
      global_delete_message: { Args: { p_id: string }; Returns: Json }
      global_edit_message: {
        Args: { p_body: string; p_id: string }
        Returns: Json
      }
      global_history: {
        Args: { p_before_at?: string; p_before_id?: string; p_limit?: number }
        Returns: Json
      }
      global_mark_read: { Args: never; Returns: Json }
      global_send_message: {
        Args: { p_body: string; p_reply_to?: string }
        Returns: Json
      }
      global_set_pin: { Args: { p_text: string }; Returns: Json }
      global_set_slow_mode: { Args: { p_seconds: number }; Returns: Json }
      grade_class_submission: {
        Args: { p_feedback?: string; p_score: number; p_submission_id: string }
        Returns: undefined
      }
      grant_eno_exam_retake: {
        Args: { p_exam_id: string; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      has_permission: {
        Args: { p_key: string; p_scope?: string }
        Returns: boolean
      }
      is_class_member: { Args: { p_class_id: string }; Returns: boolean }
      is_premium: { Args: { p_user_id?: string }; Returns: boolean }
      kioku_apply_event: {
        Args: {
          p_aspect: string
          p_at: string
          p_confidence: string
          p_correct: boolean
          p_direction: string
          p_error_type: string
          p_hint_level?: number
          p_item_id: string
          p_item_type: Database["public"]["Enums"]["content_skill"]
          p_response_ms?: number
          p_retention?: string
          p_used_hint: boolean
          p_user: string
        }
        Returns: undefined
      }
      kioku_rebuild_memory_state: { Args: never; Returns: number }
      kioku_record_events: { Args: { p_events: Json }; Returns: Json }
      link_unleveled_vocabulary_sources: {
        Args: { p_limit?: number }
        Returns: Json
      }
      mark_item_mastered: {
        Args: {
          p_item_id: string
          p_item_type: string
          p_level: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: {
          created_at: string
          due_at: string | null
          ease_factor: number
          id: string
          interval_days: number
          item_id: string
          item_type: Database["public"]["Enums"]["content_skill"]
          last_reviewed_at: string | null
          level: Database["public"]["Enums"]["jlpt_level"]
          repetitions: number
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_item_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_material_learned_atomic: {
        Args: {
          p_item_id: string
          p_item_type: Database["public"]["Enums"]["content_skill"]
          p_level: Database["public"]["Enums"]["jlpt_level"]
        }
        Returns: boolean
      }
      pending_translation_work: {
        Args: { p_limit: number; p_source_type: string }
        Returns: {
          id: string
          source_text: string
          target_text: string
        }[]
      }
      process_verified_payment_event: {
        Args: {
          p_event_key: string
          p_merchant_order_id: string
          p_payload?: Json
          p_provider: string
          p_provider_reference?: string
          p_status: string
        }
        Returns: Json
      }
      process_vocabulary_source_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      publish_admin_announcement: { Args: { p_id: string }; Returns: Json }
      record_learning_activity:
        | {
            Args: {
              p_activity_type: string
              p_content_id: string
              p_content_type: string
              p_correct?: boolean
              p_duration_seconds?: number
              p_metadata?: Json
              p_points?: number
              p_xp?: number
            }
            Returns: {
              avatar_url: string | null
              correct_answers: number
              current_streak: number
              display_name: string | null
              jlpt_level: string
              last_activity_at: string | null
              lessons_completed: number
              longest_streak: number
              quizzes_completed: number
              study_minutes: number
              total_answers: number
              total_points: number
              ui_language: string
              updated_at: string
              user_id: string
              xp: number
            }
            SetofOptions: {
              from: "*"
              to: "user_learning_stats"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_activity_type: string
              p_metadata?: Json
              p_points?: number
              p_xp?: number
            }
            Returns: {
              avatar_url: string | null
              correct_answers: number
              current_streak: number
              display_name: string | null
              jlpt_level: string
              last_activity_at: string | null
              lessons_completed: number
              longest_streak: number
              quizzes_completed: number
              study_minutes: number
              total_answers: number
              total_points: number
              ui_language: string
              updated_at: string
              user_id: string
              xp: number
            }
            SetofOptions: {
              from: "*"
              to: "user_learning_stats"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      record_quiz_attempt: {
        Args: {
          p_correct_count: number
          p_duration_seconds?: number
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_quiz_id: string
          p_skill: Database["public"]["Enums"]["content_skill"]
          p_total_questions: number
        }
        Returns: {
          attempt_kind: string
          completed_at: string
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          level: Database["public"]["Enums"]["jlpt_level"] | null
          quiz_id: string | null
          score: number
          skill: Database["public"]["Enums"]["content_skill"] | null
          total_questions: number
          user_id: string
          xp_earned: number
        }
        SetofOptions: {
          from: "*"
          to: "quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_points_for_premium: {
        Args: { p_points?: number }
        Returns: number
      }
      redeem_referral_points: { Args: { p_points?: number }; Returns: number }
      refresh_adaptive_plan: { Args: { p_date: string }; Returns: undefined }
      save_eno_monthly_exam: {
        Args: {
          p_closes_at?: string
          p_duration_minutes?: number
          p_exam_month?: string
          p_id?: string
          p_level?: string
          p_opens_at?: string
          p_passing_score?: number
          p_status?: string
          p_title?: string
        }
        Returns: string
      }
      set_content_review_status: {
        Args: {
          p_id: string
          p_note?: string
          p_severity?: string
          p_status: string
          p_type: string
        }
        Returns: undefined
      }
      set_eno_monthly_exam_status: {
        Args: { p_exam_id: string; p_status: string }
        Returns: Json
      }
      set_my_daily_reminder: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      social_admin_report_resolve: {
        Args: { p_action: string; p_id: string; p_note?: string }
        Returns: Json
      }
      social_admin_reports: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      social_admin_suspend: {
        Args: { p_reason?: string; p_suspend: boolean; p_user: string }
        Returns: Json
      }
      social_admin_term_upsert: {
        Args: {
          p_active?: boolean
          p_category?: string
          p_language?: string
          p_match_type?: string
          p_term: string
        }
        Returns: Json
      }
      social_admin_terms_list: { Args: never; Returns: Json }
      social_admin_username_history: { Args: { p_user: string }; Returns: Json }
      social_assert_clean: {
        Args: { p_code?: string; p_text: string }
        Returns: undefined
      }
      social_assert_link_allowed: {
        Args: { p_body: string; p_uid: string }
        Returns: undefined
      }
      social_assert_member: { Args: never; Returns: string }
      social_assert_moderator: { Args: never; Returns: string }
      social_assert_writer: { Args: never; Returns: string }
      social_backfill_owner_friends: { Args: never; Returns: Json }
      social_badges: { Args: { p_users: string[] }; Returns: Json }
      social_block: { Args: { p_user: string }; Returns: Json }
      social_blocked_between: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      social_change_username: { Args: { p_username: string }; Returns: Json }
      social_contains_link: { Args: { p_text: string }; Returns: boolean }
      social_dm_allowed: {
        Args: { p_from: string; p_to: string }
        Returns: string
      }
      social_drop_pending: {
        Args: { p_a: string; p_b: string; p_requester: string }
        Returns: boolean
      }
      social_effectively_empty: { Args: { p_text: string }; Returns: boolean }
      social_end_friendship: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      social_is_owner: { Args: { p_user: string }; Returns: boolean }
      social_is_staff: { Args: { p_user: string }; Returns: boolean }
      social_me: { Args: never; Returns: Json }
      social_mute_remove: {
        Args: { p_other: string; p_user: string }
        Returns: boolean
      }
      social_normalize_text: { Args: { p_text: string }; Returns: string }
      social_official_lookalike: { Args: { p_text: string }; Returns: boolean }
      social_overview: { Args: never; Returns: Json }
      social_owner_befriend: { Args: { p_user: string }; Returns: number }
      social_profile_card:
        | { Args: { p_user: string }; Returns: Json }
        | { Args: { p_public: boolean; p_user: string }; Returns: Json }
      social_prune_logs: { Args: never; Returns: number }
      social_report_message: {
        Args: { p_message_id: string; p_reason?: string; p_scope: string }
        Returns: Json
      }
      social_report_submit: {
        Args: {
          p_category: string
          p_reason: string
          p_scope: string
          p_target: string
        }
        Returns: Json
      }
      social_report_user: {
        Args: { p_reason?: string; p_user: string }
        Returns: Json
      }
      social_resolve_request_notifications: {
        Args: { p_requester: string; p_target: string }
        Returns: undefined
      }
      social_safe_photo: { Args: { p_url: string }; Returns: string }
      social_search_users: { Args: { p_query: string }; Returns: Json }
      social_set_privacy: {
        Args: { p_allow_friend_requests: boolean }
        Returns: Json
      }
      social_set_sound: { Args: { p_enabled: boolean }; Returns: Json }
      social_set_username: {
        Args: { p_display_name?: string; p_username: string }
        Returns: Json
      }
      social_unblock: { Args: { p_user: string }; Returns: Json }
      social_unread_summary: { Args: never; Returns: Json }
      social_update_settings: {
        Args: {
          p_dm_policy?: string
          p_show_country?: boolean
          p_show_jlpt?: boolean
          p_show_online?: boolean
          p_show_xp?: boolean
        }
        Returns: Json
      }
      social_user_by_username: { Args: { p_username: string }; Returns: Json }
      social_username_reserved: { Args: { p_name: string }; Returns: boolean }
      start_eno_monthly_exam: { Args: { p_exam_id: string }; Returns: Json }
      start_jlpt_simulation_full: {
        Args: { p_exam_no?: number; p_level: string }
        Returns: string
      }
      study_active_offsets: { Args: { p_days: number }; Returns: number[] }
      study_week_quota: {
        Args: {
          p_active: string[]
          p_past: string[]
          p_plan: string
          p_today: string
          p_type: string
          p_user: string
          p_week_start: string
        }
        Returns: {
          done: number
          past_target: number
        }[]
      }
      submit_class_quiz: {
        Args: { p_answers: Json; p_quiz_id: string }
        Returns: {
          attempt_id: string
          correct_count: number
          score: number
          total_questions: number
        }[]
      }
      submit_eno_monthly_exam: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      submit_jlpt_simulation_full_section: {
        Args: {
          p_answers: Json
          p_duration_seconds: number
          p_full_session_id: string
          p_level: string
          p_section: string
          p_session_index: number
        }
        Returns: {
          attempt_id: string
          correct_count: number
          score_percent: number
          total_questions: number
        }[]
      }
      submit_jlpt_simulation_section: {
        Args: {
          p_answers: Json
          p_duration_seconds: number
          p_level: string
          p_section: string
        }
        Returns: {
          attempt_id: string
          correct_count: number
          score_percent: number
          total_questions: number
        }[]
      }
      submit_practice_quiz: {
        Args: {
          p_answers: Json
          p_duration_seconds?: number
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_skill: Database["public"]["Enums"]["content_skill"]
        }
        Returns: {
          attempt_kind: string
          completed_at: string
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          level: Database["public"]["Enums"]["jlpt_level"] | null
          quiz_id: string | null
          score: number
          skill: Database["public"]["Enums"]["content_skill"] | null
          total_questions: number
          user_id: string
          xp_earned: number
        }
        SetofOptions: {
          from: "*"
          to: "quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quiz_attempt: {
        Args: {
          p_answers: Json
          p_duration_seconds?: number
          p_level: Database["public"]["Enums"]["jlpt_level"]
          p_quiz_id: string
          p_skill: Database["public"]["Enums"]["content_skill"]
        }
        Returns: {
          attempt_kind: string
          completed_at: string
          correct_count: number
          created_at: string
          duration_seconds: number
          id: string
          level: Database["public"]["Enums"]["jlpt_level"] | null
          quiz_id: string | null
          score: number
          skill: Database["public"]["Enums"]["content_skill"] | null
          total_questions: number
          user_id: string
          xp_earned: number
        }
        SetofOptions: {
          from: "*"
          to: "quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_user_report: {
        Args: { p_category: string; p_description: string; p_subject: string }
        Returns: string
      }
      sync_daily_study_task_progress: {
        Args: { p_study_date?: string }
        Returns: {
          completed_at: string | null
          completed_count: number
          created_at: string
          id: string
          metadata: Json
          plan_id: string
          priority: number
          reason: string | null
          study_date: string
          target_count: number
          task_type: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_study_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      teacher_create_class: {
        Args: {
          p_banner_url?: string
          p_capacity?: number
          p_class_mode?: string
          p_currency?: string
          p_description?: string
          p_ends_at?: string
          p_level: string
          p_meeting_url?: string
          p_price?: number
          p_starts_at?: string
          p_status?: string
          p_title: string
        }
        Returns: string
      }
      teacher_create_class_quiz_with_questions: {
        Args: { p_class_id: string; p_data: Json; p_questions: Json }
        Returns: string
      }
      teacher_create_class_with_sessions: {
        Args: { p_data: Json; p_sessions: Json }
        Returns: string
      }
      teacher_grade_assignment: {
        Args: {
          p_feedback: string
          p_score: number
          p_submission_id: string
          p_weakness: string
        }
        Returns: undefined
      }
      teacher_manage_class:
        | {
            Args: { p_action: string; p_data?: Json; p_id?: string }
            Returns: Json
          }
        | {
            Args: { p_action: string; p_class_id: string; p_data?: Json }
            Returns: undefined
          }
      teacher_set_content_published: {
        Args: { p_id: string; p_kind: string; p_published: boolean }
        Returns: Json
      }
      undo_last_flashcard_review: {
        Args: {
          p_item_id: string
          p_item_type: Database["public"]["Enums"]["content_skill"]
        }
        Returns: boolean
      }
      update_study_days_per_week: {
        Args: { p_days: number }
        Returns: {
          created_at: string
          daily_minutes: number
          id: string
          preferred_new_grammar: number
          preferred_new_kanji: number
          preferred_new_vocabulary: number
          preferred_quiz: number
          preferred_review: number
          start_date: string
          status: string
          study_days_per_week: number
          target_date: string
          target_level: Database["public"]["Enums"]["jlpt_level"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_translation_cron_secret: {
        Args: { p_candidate: string }
        Returns: boolean
      }
      vocabulary_primary_category_slugs: {
        Args: { p_part_of_speech: string }
        Returns: string[]
      }
      vocabulary_subcategory_slugs: {
        Args: {
          p_category_slug: string
          p_meaning_id: string
          p_part_of_speech: string
          p_reading: string
          p_term: string
        }
        Returns: string[]
      }
    }
    Enums: {
      content_skill:
        | "kanji"
        | "vocabulary"
        | "grammar"
        | "reading"
        | "listening"
      jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1"
      progress_status: "new" | "learning" | "review" | "mastered"
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
    Enums: {
      content_skill: ["kanji", "vocabulary", "grammar", "reading", "listening"],
      jlpt_level: ["N5", "N4", "N3", "N2", "N1"],
      progress_status: ["new", "learning", "review", "mastered"],
    },
  },
} as const
