import { LoginForm } from '@/components/lumora/login-form';
import { LoginModalPreview } from '@/components/lumora/login-modal-preview';
import { LogoFull } from '@/components/lumora/logo';
import { IS_LOCAL_AUTH, IS_DEMO_AUTH } from '@/lib/auth/mode';

export const metadata = { title: 'Sign in — Lumora' };

export default function LoginPage() {
  return (
    <main className="lumora-login">
      <section className="lumora-login-story">
        <LogoFull height={32} />
        <div>
          <span className="lumora-intro-label">A clearer way forward</span>
          <h1>
            Good decisions
            <br />
            start with a<br />
            little clarity.
          </h1>
          <p>
            Your space to explore possibilities, compare what matters, and take
            the next step with confidence.
          </p>
        </div>
        <span className="lumora-login-foot">Less noise. More perspective.</span>
      </section>
      <section className="lumora-login-form" aria-label="Sign in">
        {IS_LOCAL_AUTH || IS_DEMO_AUTH ? <LoginForm /> : <LoginModalPreview />}
      </section>
    </main>
  );
}
