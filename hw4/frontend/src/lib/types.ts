export interface SizeStock {
  size: string;
  quantity: number;
}

export interface ProductSummary {
  product_id: string;
  name: string;
  garment_type: string;
  category: string;
  description: string;
  short_description: string;
  colors: string[];
  price: number;
  image_url: string;
  total_quantity: number;
  sizes_available: number;
  sizes_in_stock: string[];
}

export interface ProductDetail extends ProductSummary {
  search_tags: string[];
  sizes: SizeStock[];
  total_quantity: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ProductSummary[];
}
