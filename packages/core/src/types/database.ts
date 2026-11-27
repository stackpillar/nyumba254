/**
 * Nyumba254 Database Types
 * Generated from Supabase schema - keep in sync with migrations
 * Run `pnpm db:types` to regenerate
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          avatar_url: string | null;
          identity_verified: boolean | null;
          verification_status: string | null;
          verification_documents: Json | null;
          verified_at: string | null;
          account_type: string | null;
          verified_role: string | null;
          role_verified_at: string | null;
          role_set_at: string | null;
          page_handle: string | null;
          page_visibility: string | null;
          page_bio: string | null;
          page_location: string | null;
          company_name: string | null;
          company_type: string | null;
          company_registration: string | null;
          company_logo: string | null;
          company_description: string | null;
          company_website: string | null;
          subscription_tier: string | null;
          subscription_plan: string | null;
          subscription_expires_at: string | null;
          has_bnb_capacity: boolean | null;
          bnb_expires_at: string | null;
          has_rental_capacity: boolean | null;
          ai_listing_uses_month: string | null;
          ai_listing_uses_count: number | null;
          sms_alerts_enabled: boolean | null;
          push_notifications_enabled: boolean | null;
          email_notifications_enabled: boolean | null;
          viewing_fee_default: number | null;
          viewing_fee_policy_accepted: boolean | null;
          concierge_enabled: boolean | null;
          kyc_status: string | null;
          kyc_session_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      listings: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          seller_id: string;
          title: string;
          description: string | null;
          category: string;
          price_type: string;
          price_frequency: string;
          price: number;
          area: string | null;
          county: string | null;
          address: string | null;
          latitude: number | null;
          longitude: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          furnished: string | null;
          amenities: string[] | null;
          details: Json | null;
          status: string;
          is_featured: boolean | null;
          is_disabled: boolean | null;
          recycle_bin: boolean | null;
          payment_status: string | null;
          publish_at: string | null;
          listing_number: number;
          whatsapp: string | null;
          phone: string | null;
          viewing_fee: number | null;
          viewing_fee_status: string | null;
        };
        Insert: Omit<Database['public']['Tables']['listings']['Row'], 'id' | 'created_at' | 'updated_at' | 'listing_number'>;
        Update: Partial<Database['public']['Tables']['listings']['Insert']>;
      };
      listing_photos: {
        Row: {
          id: string;
          created_at: string;
          listing_id: string;
          url: string;
          position: number | null;
          is_cover: boolean | null;
        };
        Insert: Omit<Database['public']['Tables']['listing_photos']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['listing_photos']['Insert']>;
      };
      listing_videos: {
        Row: {
          id: string;
          created_at: string;
          listing_id: string;
          url: string;
          position: number | null;
          is_cover: boolean | null;
        };
        Insert: Omit<Database['public']['Tables']['listing_videos']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['listing_videos']['Insert']>;
      };
      enquiries: {
        Row: {
          id: string;
          created_at: string;
          listing_id: string;
          buyer_id: string | null;
          buyer_name: string | null;
          buyer_email: string | null;
          buyer_phone: string | null;
          message: string;
          status: string;
          is_read: boolean | null;
        };
        Insert: Omit<Database['public']['Tables']['enquiries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['enquiries']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          created_at: string;
          listing_id: string;
          sender_id: string;
          content: string;
          is_read: boolean | null;
          message_type: string | null;
          metadata: Json | null;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      chat_sessions: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          session_key: string;
          session_type: string;
          seller_id: string;
          buyer_id: string | null;
          listing_id: string | null;
          visitor_name: string | null;
          page: string | null;
          topic: string | null;
          status: string;
          is_resolved: boolean | null;
          last_msg_at: string;
          unread_count: number | null;
        };
        Insert: Omit<Database['public']['Tables']['chat_sessions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['chat_sessions']['Insert']>;
      };
      viewing_requests: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          listing_id: string;
          buyer_id: string | null;
          buyer_name: string | null;
          buyer_phone: string | null;
          buyer_email: string | null;
          preferred_date: string;
          preferred_time: string;
          status: string;
          viewing_fee: number | null;
          fee_status: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['viewing_requests']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['viewing_requests']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          created_at: string;
          seller_id: string;
          listing_id: string | null;
          amount: number;
          currency: string;
          reference: string;
          status: string;
          payment_method: string | null;
          provider_reference: string | null;
          description: string | null;
          metadata: Json | null;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          created_at: string;
          seller_id: string;
          type: string;
          title: string;
          body: string;
          link: string | null;
          is_read: boolean | null;
          metadata: Json | null;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      reviews: {
        Row: {
          id: string;
          created_at: string;
          listing_id: string;
          reviewer_id: string;
          reviewer_name: string | null;
          rating: number;
          comment: string | null;
          review_type: string;
          is_anonymous: boolean | null;
          response: string | null;
          responded_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
      };
      saved_listings: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          listing_id: string;
        };
        Insert: Omit<Database['public']['Tables']['saved_listings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['saved_listings']['Insert']>;
      };
      team_members: {
        Row: {
          id: string;
          created_at: string;
          owner_id: string;
          member_id: string;
          role: string;
          status: string;
          invited_at: string | null;
          accepted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['team_members']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>;
      };
      social_links: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          profile_id: string;
          platform: string;
          handle: string;
          url: string;
          is_visible: boolean | null;
          click_count: number | null;
        };
        Insert: Omit<Database['public']['Tables']['social_links']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['social_links']['Insert']>;
      };
      quick_answers: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          profile_id: string;
          listing_id: string | null;
          question: string;
          answer: string;
        };
        Insert: Omit<Database['public']['Tables']['quick_answers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['quick_answers']['Insert']>;
      };
      activity_events: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          event_type: string;
          description: string;
          metadata: Json | null;
        };
        Insert: Omit<Database['public']['Tables']['activity_events']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activity_events']['Insert']>;
      };
      platform_settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: Database['public']['Tables']['platform_settings']['Row'];
        Update: Partial<Database['public']['Tables']['platform_settings']['Insert']>;
      };
      app_push_tokens: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          token: string;
          platform: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['app_push_tokens']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['app_push_tokens']['Insert']>;
      };
      listing_units: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          listing_id: string;
          unit_number: string;
          tenant_name: string | null;
          tenant_phone: string | null;
          tenant_email: string | null;
          lease_start: string | null;
          lease_end: string | null;
          rent_amount: number | null;
          rent_due_day: number | null;
          deposit_amount: number | null;
          status: string;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['listing_units']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['listing_units']['Insert']>;
      };
      rent_payments: {
        Row: {
          id: string;
          created_at: string;
          unit_id: string;
          amount: number;
          due_date: string;
          paid_date: string | null;
          status: string;
          payment_method: string | null;
          reference: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['rent_payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rent_payments']['Insert']>;
      };
      maintenance_requests: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          unit_id: string;
          title: string;
          description: string;
          priority: string;
          status: string;
          assigned_to: string | null;
          completed_at: string | null;
          cost: number | null;
        };
        Insert: Omit<Database['public']['Tables']['maintenance_requests']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['maintenance_requests']['Insert']>;
      };
      bnb_properties: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          seller_id: string;
          listing_id: string | null;
          name: string;
          description: string | null;
          address: string;
          check_in_time: string | null;
          check_out_time: string | null;
          max_guests: number | null;
          base_price: number | null;
          cleaning_fee: number | null;
          service_fee: number | null;
          status: string;
        };
        Insert: Omit<Database['public']['Tables']['bnb_properties']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bnb_properties']['Insert']>;
      };
      bnb_bookings: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          property_id: string;
          guest_name: string;
          guest_email: string | null;
          guest_phone: string | null;
          check_in: string;
          check_out: string;
          guests: number;
          total_price: number;
          status: string;
          source: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['bnb_bookings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['bnb_bookings']['Insert']>;
      };
    };
    Views: {
      public_account_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          identity_verified: boolean | null;
          verification_status: string | null;
          account_type: string | null;
          verified_role: string | null;
          page_handle: string | null;
          page_visibility: string | null;
        };
      };
    };
    Functions: {
      search_public_listing_ids: {
        Args: {
          p_category?: string;
          p_frequency?: string;
          p_county?: string;
          p_areas?: string[] | null;
          p_min_price?: number | null;
          p_max_price?: number | null;
          p_bedrooms?: string;
          p_furnished?: string;
          p_amenities?: string[] | null;
          p_search?: string;
          p_include_occupied?: boolean;
          p_lister_filter?: string;
          p_viewing_fee_filter?: string;
          p_sort?: string;
          p_map_ids?: string[];
          p_offset?: number;
          p_limit?: number;
        };
        Returns: {
          listing_id: string;
          total_count: number;
        }[];
      };
      get_public_viewing_fees: {
        Args: { p_listing_ids: string[] };
        Returns: { listing_id: string; viewing_fee: number }[];
      };
      nk_listing_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total: number;
          categories: Record<string, number>;
          counties: Record<string, number>;
        };
      };
      get_public_lister_page: {
        Args: { p_handle: string };
        Returns: {
          id: string;
          full_name: string | null;
          identity_verified: boolean | null;
          verification_status: string | null;
          account_type: string | null;
          verified_role: string | null;
          page_handle: string | null;
          page_visibility: string | null;
          page_bio: string | null;
          page_location: string | null;
          company_name: string | null;
          company_type: string | null;
          company_registration: string | null;
          company_logo: string | null;
          company_description: string | null;
          company_website: string | null;
          listing_count: number;
          redirect_to: string | null;
        } | null;
      };
      get_lister_page_handle: {
        Args: { p_lookup: string };
        Returns: string | null;
      };
      get_my_social_links: {
        Args: Record<PropertyKey, never>;
        Returns: {
          platform: string;
          handle: string;
          url: string;
          is_visible: boolean;
        }[];
      };
      set_lister_social_links: {
        Args: { links: { platform: string; handle: string; url: string; is_visible: boolean }[] };
        Returns: Json;
      };
      get_my_social_click_totals: {
        Args: Record<PropertyKey, never>;
        Returns: { platform: string; clicks: number }[];
      };
      get_public_plan_matrix: {
        Args: Record<PropertyKey, never>;
        Returns: {
          tier: string;
          plan: string;
          features: string[];
          price_monthly: number;
          price_yearly: number;
        }[];
      };
      publish_due_listings: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      prune_lister_page_analytics: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      purge_activity_events: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      get_sitemap_lister_pages: {
        Args: Record<PropertyKey, never>;
        Returns: { handle: string; lastmod: string }[];
      };
    };
    Enums: {
      account_type: 'buyer' | 'owner' | 'caretaker' | 'agent' | 'company' | 'seller';
      listing_status: 'active' | 'pending' | 'scheduled' | 'expired' | 'occupied' | 'disabled' | 'draft';
      listing_category: 'apartment' | 'house' | 'boarding' | 'airbnb' | 'commercial';
      price_type: 'rent' | 'sale';
      price_frequency: 'month' | 'night' | 'week' | 'term' | 'semester' | 'once';
      enquiry_status: 'new' | 'read' | 'replied' | 'archived';
      message_type: 'text' | 'image' | 'system' | 'viewing_request' | 'quick_answer';
      chat_session_status: 'open' | 'closed' | 'archived';
      chat_session_type: 'buyer' | 'seller' | 'support';
      viewing_status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'trial';
      notification_type: 'enquiry' | 'message' | 'viewing_request' | 'viewing_confirmed' | 'viewing_completed' | 'payment' | 'listing_approved' | 'listing_expiring' | 'review' | 'system';
      review_type: 'platform' | 'listing' | 'lister';
      team_role: 'admin' | 'member' | 'viewer';
      team_status: 'active' | 'pending' | 'invited';
      subscription_tier: 'none' | 'free' | 'premium' | 'elite';
      subscription_plan: 'monthly' | 'yearly' | 'trial';
      kyc_status: 'not_started' | 'pending' | 'verified' | 'rejected';
      rent_ledger_status: 'paid' | 'pending' | 'overdue' | 'partial' | 'waived';
      maintenance_priority: 'low' | 'medium' | 'high' | 'urgent';
      maintenance_status: 'open' | 'in_progress' | 'completed' | 'cancelled';
      bnb_property_status: 'active' | 'inactive' | 'maintenance';
      bnb_booking_status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
    };
  };
}

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Common type aliases
export type Profile = Tables<'profiles'>;
export type Listing = Tables<'listings'>;
export type ListingPhoto = Tables<'listing_photos'>;
export type ListingVideo = Tables<'listing_videos'>;
export type Enquiry = Tables<'enquiries'>;
export type Message = Tables<'messages'>;
export type ChatSession = Tables<'chat_sessions'>;
export type ViewingRequest = Tables<'viewing_requests'>;
export type Payment = Tables<'payments'>;
export type Notification = Tables<'notifications'>;
export type Review = Tables<'reviews'>;
export type SavedListing = Tables<'saved_listings'>;
export type TeamMember = Tables<'team_members'>;
export type SocialLink = Tables<'social_links'>;
export type QuickAnswer = Tables<'quick_answers'>;
export type ActivityEvent = Tables<'activity_events'>;
export type PlatformSetting = Tables<'platform_settings'>;
export type AppPushToken = Tables<'app_push_tokens'>;
export type ListingUnit = Tables<'listing_units'>;
export type RentPayment = Tables<'rent_payments'>;
export type MaintenanceRequest = Tables<'maintenance_requests'>;
export type BnbProperty = Tables<'bnb_properties'>;
export type BnbBooking = Tables<'bnb_bookings'>;

export type PublicAccountProfile = Database['public']['Views']['public_account_profiles']['Row'];