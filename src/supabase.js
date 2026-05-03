import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uukzqsarylyxppxytqpx.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1a3pxc2FyeWx5eHBweHl0cXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzAwNDAsImV4cCI6MjA5MzI0NjA0MH0.420bxcqRgIr8Zoi_UWKR3xqvZaPHT1LUoCzdCWKmOMI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)