export type SchoolLevel = "elementary" | "secondary";

export type ProfileStatus = "pending" | "approved" | "rejected";
export type ProfileRole = "teacher" | "admin";

export type SharePostStatus = "available" | "reserved" | "completed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          nickname: string;
          school_id: string | null;
          role: ProfileRole;
          status: ProfileStatus;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          nickname: string;
          school_id?: string | null;
          role?: ProfileRole;
          status?: ProfileStatus;
        };
        Update: Partial<{
          full_name: string;
          nickname: string;
          school_id: string | null;
          role: ProfileRole;
          status: ProfileStatus;
        }>;
        Relationships: [];
      };
      schools: {
        Row: {
          id: string;
          kakao_place_id: string;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: {
          kakao_place_id: string;
          name: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
        };
        Update: Partial<{
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
        }>;
        Relationships: [];
      };
      item_types: {
        Row: { id: string; label: string; carbon_g: number };
        Insert: { label: string; carbon_g: number };
        Update: Partial<{ label: string; carbon_g: number }>;
        Relationships: [];
      };
      share_posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          description: string;
          school_level: SchoolLevel;
          category: string;
          item_type_id: string;
          carbon_g: number;
          status: SharePostStatus;
          reserved_by: string | null;
          reserved_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          author_id: string;
          title: string;
          description: string;
          school_level: SchoolLevel;
          category: string;
          item_type_id: string;
          carbon_g: number;
        };
        Update: Partial<{
          status: SharePostStatus;
          reserved_by: string | null;
          reserved_at: string | null;
          completed_at: string | null;
        }>;
        Relationships: [];
      };
      share_post_images: {
        Row: { id: string; post_id: string; storage_path: string; sort_order: number };
        Insert: { post_id: string; storage_path: string; sort_order: number };
        Update: Partial<{ storage_path: string; sort_order: number }>;
        Relationships: [];
      };
      share_comments: {
        Row: { id: string; post_id: string; author_id: string; body: string; created_at: string };
        Insert: { post_id: string; author_id: string; body: string };
        Update: Partial<{ body: string }>;
        Relationships: [];
      };
      club_posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          description: string;
          school_level: SchoolLevel;
          category: string;
          created_at: string;
        };
        Insert: {
          author_id: string;
          title: string;
          description: string;
          school_level: SchoolLevel;
          category: string;
        };
        Update: Partial<{ title: string; description: string }>;
        Relationships: [];
      };
      club_post_images: {
        Row: { id: string; post_id: string; storage_path: string; sort_order: number };
        Insert: { post_id: string; storage_path: string; sort_order: number };
        Update: Partial<{ storage_path: string; sort_order: number }>;
        Relationships: [];
      };
      club_comments: {
        Row: { id: string; post_id: string; author_id: string; body: string; created_at: string };
        Insert: { post_id: string; author_id: string; body: string };
        Update: Partial<{ body: string }>;
        Relationships: [];
      };
      school_review_questions: {
        Row: { id: string; text: string; sort_order: number; is_active: boolean };
        Insert: { text: string; sort_order?: number; is_active?: boolean };
        Update: Partial<{ text: string; sort_order: number; is_active: boolean }>;
        Relationships: [];
      };
      school_reviews: {
        Row: { id: string; school_id: string; user_id: string; created_at: string };
        Insert: { school_id: string; user_id: string };
        Update: Partial<{ school_id: string; user_id: string }>;
        Relationships: [];
      };
      school_review_answers: {
        Row: { id: string; review_id: string; question_id: string; score: number };
        Insert: { review_id: string; question_id: string; score: number };
        Update: Partial<{ score: number }>;
        Relationships: [];
      };
      school_search_cache: {
        Row: { id: string; query_key: string; fetched_at: string };
        Insert: { query_key: string; fetched_at?: string };
        Update: Partial<{ fetched_at: string }>;
        Relationships: [];
      };
      school_search_cache_items: {
        Row: { id: string; cache_id: string; school_id: string; rank: number };
        Insert: { cache_id: string; school_id: string; rank: number };
        Update: Partial<{ rank: number }>;
        Relationships: [];
      };
    };
    Views: {
      user_carbon_totals: {
        Row: { user_id: string; total_carbon_g: number };
        Relationships: [];
      };
      school_rating_summary: {
        Row: {
          school_id: string;
          question_id: string;
          question_text: string;
          avg_score: number | null;
          answer_count: number;
        };
        Relationships: [];
      };
      school_review_participant_counts: {
        Row: { school_id: string; participant_count: number };
        Relationships: [];
      };
      public_profiles: {
        Row: { id: string; nickname: string };
        Relationships: [];
      };
    };
    Functions: {
      submit_school_review: {
        Args: { target_school_id: string; answer_scores: Record<string, number> };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
