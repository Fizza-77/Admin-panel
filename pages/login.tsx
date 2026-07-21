import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import {
  ArrowRight,
  CheckSquare,
  LayoutDashboard,
  Lock,
  Mail,
  Shield,
} from 'lucide-react';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { saveAdminClientSession } from '@/lib/client/adminSession';
import { reportError } from '@/lib/monitoring';

const loginSchema = z.object({
  email: z.string().email({ message: 'Valid email is required' }),
  password: z.string().min(1, { message: 'Password is required' }),
});

type LoginForm = z.infer<typeof loginSchema>;

const highlights = [
  { icon: LayoutDashboard, text: 'Blog & site management' },
  { icon: CheckSquare, text: 'Kanban tasks & assignments' },
  { icon: Shield, text: 'Role-based secure access' },
];

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');

    try {
      const { data: body } = await axios.post<{
        success: boolean;
        session?: { userId: string; email: string | null; permissions: import('@/lib/permissions/types').AppPermissions };
      }>('/api/login', data, { withCredentials: true });

      if (body.session?.userId && body.session.permissions) {
        saveAdminClientSession({
          userId: body.session.userId,
          email: body.session.email,
          permissions: body.session.permissions,
        });
      }

      await router.push('/');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as Error)?.message ||
        'Invalid login credentials';
      reportError(err, { source: 'Login.onSubmit', email: data.email });
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign in · Skyen Systems</title>
        <meta name="description" content="Sign in to the Skyen Systems Admin Panel" />
      </Head>

      {isLoading && <LoadingOverlay label="Signing in…" />}

      <div className="relative flex min-h-screen overflow-hidden bg-zinc-950">
        {/* Ambient background */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-indigo-600/30 blur-[100px]" />
          <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-violet-600/25 blur-[90px]" />
          <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        {/* Brand panel — desktop */}
        <aside
          className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col justify-between border-r border-white/5 p-12 xl:p-16"
          aria-hidden={false}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
                {logoFailed ? (
                  <span className="text-lg font-bold text-white" aria-hidden>
                    S
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/skyen-systems.png"
                    alt="Skyen Systems"
                    width={32}
                    height={32}
                    className="object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/90">Skyen Systems</p>
                <p className="text-lg font-semibold text-white">Admin Panel</p>
              </div>
            </div>

            <h1 className="mt-16 max-w-lg text-4xl font-semibold leading-[1.15] tracking-tight text-white xl:text-5xl">
              Your control center for content, tasks, and teams.
            </h1>

            <ul className="mt-10 space-y-4">
              {highlights.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                    <Icon className="h-4 w-4 text-indigo-300" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 text-xs text-zinc-600">
            © {new Date().getFullYear()} Skyen Systems · Internal admin access only
          </p>
        </aside>

        {/* Form panel */}
        <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[420px] animate-fade-in">
            {/* Mobile brand */}
            <div className="mb-10 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 shadow-lg shadow-black/20 ring-1 ring-white/20 backdrop-blur-sm">
                {logoFailed ? (
                  <span className="text-xl font-bold text-white" aria-hidden>
                    S
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/skyen-systems.png"
                    alt="Skyen Systems"
                    width={40}
                    height={40}
                    className="object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Skyen Systems</h1>
              <p className="mt-1 text-sm font-medium text-indigo-300/90">Admin Panel</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
              <div className="mb-8 hidden lg:block">
                <h2 className="text-xl font-semibold text-white">Welcome back</h2>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                {error && (
                  <div
                    className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                    role="alert"
                  >
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" aria-hidden />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-300">
                    Email address
                  </label>
                  <div className="group relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500 transition group-focus-within:text-indigo-400"
                      aria-hidden
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="username"
                      {...register('email')}
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-500 transition focus:border-indigo-500/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="you@company.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-400" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-300">
                    Password
                  </label>
                  <div className="group relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500 transition group-focus-within:text-indigo-400"
                      aria-hidden
                    />
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      {...register('password')}
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-zinc-500 transition focus:border-indigo-500/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      placeholder="••••••••••"
                    />
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-400" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <OutlineFillButtonAction
                  type="submit"
                  disabled={isLoading}
                  className="!w-full mt-2 ui-outline-fill-btn--inverse"
                  icon={<ArrowRight className="h-[15px] w-[15px]" aria-hidden />}
                >
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </OutlineFillButtonAction>
              </form>

              <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
                <Shield className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                Encrypted session · Authorized personnel only
              </p>
            </div>

            <p className="mt-8 text-center text-xs text-zinc-600 lg:hidden">
              © {new Date().getFullYear()} Skyen Systems
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
