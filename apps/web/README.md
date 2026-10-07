# crewjobs - Job Application Tracker

A modern, feature-rich web application to manage and track your job applications with ease. Keep everything organized in one place and never miss a follow-up.

![Node](https://img.shields.io/badge/Node.js-18+-green)
![Next.js](https://img.shields.io/badge/Next.js-16+-blue)
![React](https://img.shields.io/badge/React-19+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1+-blue)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## Features

### 📊 Application Management
- **Track Applications**: Add and manage all your job applications in one centralized dashboard
- **Rich Details**: Store company name, job title, position link, platform, status, and notes
- **Flexible Statuses**: Applied, Interview, Offer, Rejected, Withdrawn, No Response
- **Multiple Platforms**: Track applications from LinkedIn, Indeed, Glassdoor, company websites, and more

### 📅 Follow-up Management
- **Auto Follow-up Dates**: Automatically set follow-up dates based on applied date
- **Overdue Tracking**: Visual alerts for overdue follow-ups with red highlighting
- **Custom Reminders**: Set custom follow-up dates for each application

### 🔍 Search & Filter
- **Smart Search**: Search by company name or job title
- **Status Filter**: Filter applications by their current status
- **Platform Filter**: View applications by job board platform
- **Date Range Filter**: Filter applications by applied date range
- **Sorting**: Sort by applied date or company name, ascending or descending

### 📈 Dashboard Analytics
- **Quick Stats**: View total applications, interviews, and offers at a glance
- **Status Breakdown**: See distribution of applications across different statuses
- **Success Metrics**: Track acceptance rate and interview conversion rate
- **Recent Activity**: Quick view of recent applications and their status

### ⚡ Bulk Import
- **Quick Paste**: Paste multiple job applications at once
- **Multiple Formats**: Support for pipe-delimited, tab-separated, or URL-only formats
- **Data Validation**: Preview and validate data before importing
- **Error Handling**: Identify and fix invalid entries before bulk insertion

### 🔐 Authentication
- **Email/Password**: Secure email and password authentication
- **Google OAuth**: Sign in with your Google account
- **Session Management**: Secure, persistent sessions with Supabase

### 🎨 User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: Built-in dark mode support with theme switching
- **Real-time Updates**: Table refreshes immediately after adding or editing applications
- **Customizable Settings**: Personalize default platform, status, and follow-up days

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible component library
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **Sonner** - Toast notifications

### Backend & Database
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Supabase SSR** - Server-side rendering support
- **Server Actions** - Next.js server-side functions for data operations

### Development
- **pnpm** - Package manager
- **ESLint** - Code linting
- **Vercel** - Deployment platform

## Getting Started

### Prerequisites
- Node.js 18 or higher
- pnpm package manager
- Supabase account (free tier available)
- Google Cloud account (for OAuth)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/crewjobs.git
   cd crewjobs
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   Get these from your Supabase project settings.

4. **Set up Supabase**

   - Create a new Supabase project
   - Run the database migration script in `scripts/` directory
   - Or create the tables manually (see Database Schema section)

5. **Configure Google OAuth (Optional)**

   See [Google Auth Setup Guide](docs/GOOGLE_AUTH_SETUP.md) for detailed instructions.

6. **Start development server**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

### job_applications table
```sql
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  link TEXT,
  platform VARCHAR(50),
  status VARCHAR(50),
  applied_at TIMESTAMP WITH TIME ZONE,
  follow_up_at DATE,
  location_restriction VARCHAR(255),
  job_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_platform ON job_applications(platform);
```

### settings table
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  default_platform VARCHAR(50),
  default_status VARCHAR(50),
  follow_up_offset_days INTEGER DEFAULT 7,
  platform_options TEXT[] DEFAULT ARRAY['LinkedIn', 'Indeed', 'Glassdoor'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Project Structure

```
crewjobs/
├── app/                          # Next.js app directory
│   ├── (protected)/             # Protected routes (require auth)
│   │   ├── applications/        # Applications management
│   │   └── dashboard/           # Dashboard & analytics
│   ├── auth/                    # Authentication pages
│   │   ├── login/
│   │   ├── sign-up/
│   │   └── callback/            # OAuth callback
│   └── layout.tsx               # Root layout
├── components/                   # React components
│   ├── auth/                    # Authentication components
│   ├── applications/            # Application-related components
│   │   ├── applications-table.tsx
│   │   ├── application-drawer.tsx
│   │   ├── quick-paste-modal.tsx
│   │   └── application-card.tsx
│   └── ui/                      # Reusable UI components
├── lib/                          # Utility functions
│   ├── actions/                 # Server actions
│   ├── supabase/                # Supabase client & server setup
│   ├── types.ts                 # TypeScript types
│   ├── validation.ts            # Zod schemas
│   └── utils.ts                 # Helper functions
├── hooks/                        # Custom React hooks
├── styles/                       # Global styles
├── public/                       # Static assets
└── docs/                         # Documentation
```

## Usage

### Adding Applications

1. **Single Application**
   - Click "Add Application" button
   - Fill in company, job title, and other details
   - Click "Save" to add the application
   - Optionally click "Save + Add Another" to add multiple applications quickly

2. **Bulk Import**
   - Click "Quick Paste" button
   - Choose format (Pipe-delimited, Tab-separated, or URL-only)
   - Paste your data
   - Review preview of valid and invalid entries
   - Click "Insert" to bulk add applications

### Managing Applications

- **Edit**: Click on any row or click the edit icon in the dropdown menu
- **Delete**: Click the delete icon in the dropdown menu
- **View Details**: Click any row to open the application drawer
- **Search**: Use the search box to find by company or title
- **Filter**: Use status, platform, and date filters

### Dashboard

- **Overview Cards**: See key metrics at a glance
- **Application Timeline**: View recent applications and their status
- **Statistics**: Track your application progress
- **Settings**: Customize default values and preferences

## Configuration

### Settings Page

Customize your default preferences:
- **Default Platform**: Pre-selected platform when adding applications
- **Default Status**: Pre-selected status for new applications
- **Follow-up Offset**: Days until automatic follow-up date (default: 7)
- **Platform Options**: Manage available platforms in dropdowns

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

### Deploy to Other Platforms

This is a standard Next.js application and can be deployed to:
- Netlify
- Firebase Hosting
- Self-hosted servers
- Docker containers

## Development

### Running Tests
```bash
pnpm test
```

### Building for Production
```bash
pnpm build
pnpm start
```

### Code Quality
```bash
pnpm lint
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Email notifications for follow-ups
- [ ] Calendar view for applications
- [ ] Interview prep guides
- [ ] Salary tracking and negotiation calculator
- [ ] Resume versioning and management
- [ ] AI-powered application insights
- [ ] Mobile app
- [ ] Team/organizational features
- [ ] Export to PDF/CSV
- [ ] API for third-party integrations

## Known Issues

- Table data may take a moment to update after bulk import with many records
- Overdue follow-ups show when follow_up_at <= today

## Troubleshooting

### Authentication Issues
- Clear browser cookies and cache
- Verify Supabase credentials in `.env.local`
- Check network tab in browser DevTools

### Data Not Showing
- Ensure Supabase tables are created
- Check user is authenticated
- Verify RLS policies allow data access

### Google OAuth Not Working
- See [Google Auth Setup Guide](docs/GOOGLE_AUTH_SETUP.md)
- Verify redirect URI matches exactly
- Check Client ID and Secret in Supabase

For more issues, check the docs folder or create an issue on GitHub.

## Performance

- Optimized database queries with proper indexing
- Lazy loading of table data with pagination
- Debounced search (300ms)
- Memoized components to prevent unnecessary re-renders
- Efficient form state management with React Hook Form
- Server-side rendering for faster initial page load

## Security

- SQL injection prevention with parameterized queries
- XSS protection with React's built-in escaping
- CSRF tokens via Supabase SSR
- Row-level security (RLS) on database tables
- Secure HTTP-only cookies for sessions
- No sensitive data stored in localStorage

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@crewjobs.app
- 💬 Discord: [Join our community](https://discord.gg/crewjobs)
- 🐛 Issues: [GitHub Issues](https://github.com/melodyxpot/crewjobs/issues)
- 📚 Documentation: [Docs](docs/)

## Acknowledgments

- [Supabase](https://supabase.com) - Backend infrastructure
- [Next.js](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Radix UI](https://www.radix-ui.com) - UI components
- [Sonner](https://sonner.emilkowal.ski) - Toast notifications

---

**Made with ❤️ by crewjobs**

*Track your journey to the perfect job.*
