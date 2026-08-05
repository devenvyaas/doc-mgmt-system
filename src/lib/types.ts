export type UserRole = 'user' | 'admin';
export type SubscriptionTier = 'free' | 'pro';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface DashboardStats {
  totalDocuments: number;
  remainingUploads: number | 'Unlimited';
  subscriptionTier: SubscriptionTier;
  maxFileSizeMB: number;
  recentDocuments: Document[];
}

export interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  freeUsersCount: number;
  proUsersCount: number;
  recentUploads: Document[];
  allUsers: Profile[];
}
