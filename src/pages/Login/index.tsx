/**
 * @fileoverview Login Page
 * 
 * Authentication page for the GSL CRM system.
 * Handles user sign-in with email and password.
 * 
 * **Key Features:**
 * - Email/password authentication via Supabase
 * - Remember me functionality
 * - Password visibility toggle
 * - Auto-redirect if already logged in
 * - Error handling and display
 * - Loading states
 * - Fallback auth user creation for existing dashboard users
 * 
 * **Flow:**
 * 1. Check for existing session on mount
 * 2. Redirect to dashboard if logged in
 * 3. Handle sign-in with Supabase Auth
 * 4. If auth user doesn't exist, attempt to create from dashboard_users
 * 5. Redirect to dashboard on successful login
 * 
 * @module pages/Login
 */

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import EditText from '../../components/ui/EditText';
import CheckBox from '../../components/ui/CheckBox';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import('../../lib/supabaseClient');
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate('/dashboard');
        }
      } catch { }
    })();
  }, [navigate]);


  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { supabase } = await import('../../lib/supabaseClient');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        navigate('/dashboard');
      }
    } catch (e: any) {
      try {
        const { supabase } = await import('../../lib/supabaseClient');
        // Ask server to provision Auth user if this email exists in app users
        const resp = await fetch('/api/admin/create-auth-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const j = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(j.error || 'Invalid login credentials');
        // Try sign-in again
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) { navigate('/dashboard'); return; }
      } catch (e2: any) {
        setError(e2?.message || e?.message || 'Invalid login credentials');
        return;
      }
      setError(e?.message || 'Invalid login credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <>
      <Helmet>
        <title>Sign In to GSL CRM | GSL Pakistan Customer Relationship Management</title>
        <meta name="description" content="Access your GSL Pakistan CRM dashboard. Sign in to manage University of Dundee cases, track tasks, and streamline your business operations with our comprehensive CRM system." />
        <meta property="og:title" content="Sign In to GSL CRM | GSL Pakistan Customer Relationship Management" />
        <meta property="og:description" content="Access your GSL Pakistan CRM dashboard. Sign in to manage University of Dundee cases, track tasks, and streamline your business operations with our comprehensive CRM system." />
      </Helmet>
      <main className="w-full min-h-screen bg-secondary-light flex justify-center items-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[1360px] mx-auto">
          <div
            className="w-full bg-secondary-background rounded-xl shadow-[0px_6px_58px_#c3cbd61a] overflow-hidden"
            style={{ marginTop: '20px', marginBottom: '30px' }}
          >
            <div className="flex flex-col lg:flex-row min-h-[600px] lg:min-h-[770px]">
              {/* Left Section - Hero */}
              <section className="w-full lg:w-[55%] bg-primary-background rounded-t-xl lg:rounded-l-xl lg:rounded-tr-none relative overflow-hidden">
                <div className="h-full flex flex-col justify-start items-start p-6 sm:p-8 lg:p-12 xl:px-[84px] xl:py-[38px]">
                  {/* Logo and Brand */}
                  <div className="flex items-center mb-6 sm:mb-8 lg:mb-[20px]">
                    <img
                      src="/images/img_gsl_logo_1_2.png"
                      alt="GSL Pakistan Logo"
                      className="w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] lg:w-[94px] lg:h-[94px] rounded-xl object-contain"
                    />
                    <h1
                      className="text-text-white font-bold ml-2 sm:ml-4 lg:-ml-1"
                      style={{
                        fontSize: '20px',
                        lineHeight: '28px',
                        fontFamily: 'Nunito Sans'
                      }}
                    >
                      GSL CRM
                    </h1>
                  </div>

                  {/* Hero Text */}
                  <div className="mb-8 sm:mb-12 lg:mb-[50px]">
                    <h2
                      className="text-text-white font-bold leading-tight mb-4"
                      style={{
                        fontSize: '24px',
                        lineHeight: '32px',
                        fontFamily: 'Nunito Sans'
                      }}
                    >
                      Your place to work<br />
                      Plan. Create. Control.
                    </h2>
                  </div>

                  {/* Illustration */}
                  <div className="flex-1 flex items-center justify-center w-full">
                    <img
                      src="/images/img_illustration_orange_400.png"
                      alt="CRM Workflow Illustration"
                      className="w-full max-w-[400px] lg:max-w-[500px] h-auto object-contain"
                      style={{ marginRight: '12px', marginBottom: '42px' }}
                    />
                  </div>
                </div>
              </section>

              {/* Right Section - Login Form */}
              <section className="w-full lg:w-[45%] flex flex-col justify-center items-center p-6 sm:p-8 lg:px-[68px] lg:pr-[56px]">
                <div className="w-full max-w-[402px] space-y-7">
                  {/* Form Header */}
                  <div className="text-center lg:text-left mb-8 lg:mb-0">
                    <h2
                      className="text-text-primary font-bold"
                      style={{
                        fontSize: '18px',
                        lineHeight: '25px',
                        fontFamily: 'Nunito Sans',
                        marginLeft: '100px'
                      }}
                    >
                      Sign In to GSL CRM
                    </h2>
                  </div>

                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label
                      className="block text-text-secondary font-bold"
                      style={{
                        fontSize: '14px',
                        lineHeight: '20px',
                        fontFamily: 'Nunito Sans',
                        marginLeft: '6px'
                      }}
                    >
                      Email Address
                    </label>
                    <EditText
                      type="email"
                      placeholder="youremail@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e?.target?.value)}
                      text_font_size="14"
                      text_font_family="Nunito Sans"
                      text_font_weight="400"
                      text_line_height="20px"
                      text_color="#7d8592"
                      fill_background_color="#ffffff"
                      border_border="1px solid #d8e0ef"
                      border_border_radius="24px"
                      effect_box_shadow="0px 1px 2px #b7c8e038"
                      padding="12px 18px"
                      margin="0 0 16px 0"
                      className="w-full"
                    />
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5" style={{ marginTop: '10px' }}>
                    <label
                      className="block text-text-secondary font-bold"
                      style={{
                        fontSize: '14px',
                        lineHeight: '20px',
                        fontFamily: 'Nunito Sans',
                        marginLeft: '6px'
                      }}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <EditText
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e?.target?.value)}
                        text_font_size="14"
                        text_font_family="Nunito Sans"
                        text_font_weight="400"
                        text_line_height="20px"
                        text_color="#7d8592"
                        fill_background_color="#ffffff"
                        border_border="1px solid #d8e0ef"
                        border_border_radius="24px"
                        effect_box_shadow="0px 1px 2px #b7c8e038"
                        padding="10px 40px 10px 16px"
                        margin="0 0 16px 0"
                        className="w-full pr-12"
                      />
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <img
                          src="/images/img_icn_input_viewpassword.png"
                          alt="Toggle password visibility"
                          className="w-6 h-6"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex justify-between items-center" style={{ marginTop: '16px' }}>
                    <CheckBox
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e?.target?.checked)}
                      text="Remember me"
                      text_font_size="16"
                      text_font_family="Nunito Sans"
                      text_font_weight="400"
                      text_line_height="22px"
                      text_color="#7d8592"
                      layout_gap="14px"
                      className="flex items-center"
                    />
                    <button
                      type="button"
                      className="text-text-secondary hover:text-text-primary transition-colors"
                      style={{
                        fontSize: '16px',
                        lineHeight: '22px',
                        fontFamily: 'Nunito Sans',
                        fontWeight: '400'
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Sign In Button */}

                  {/* Error message */}
                  {error && (
                    <div className="mt-4 text-red-600 bg-red-50 border border-red-200 rounded-md p-2 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-center" style={{ marginTop: '48px' }}>
                    <Button
                      onClick={handleSignIn}
                      disabled={isLoading || !email || !password}
                      text_font_size="16"
                      text_font_family="Nunito Sans"
                      text_font_weight="700"
                      text_line_height="22px"
                      text_color="#ffffff"
                      fill_background_color="#ffa332"
                      border_border_radius="24px"
                      effect_box_shadow="0px 6px 12px #3f8cff43"
                      padding="12px 58px 12px 34px"
                      layout_gap="6px"
                      className="flex items-center justify-center min-w-[140px] hover:opacity-90 transition-opacity"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          Sign In
                          <img
                            src="/images/img_arrowright_white_a700.png"
                            alt=""
                            className="w-6 h-6 ml-2"
                          />
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Sign Up Link */}
                  <div className="text-center" style={{ marginTop: '20px' }}>
                    <span
                      className="text-text-accent font-semibold hover:underline cursor-pointer"
                      style={{
                        fontSize: '16px',
                        lineHeight: '22px',
                        fontFamily: 'Nunito Sans',
                        fontWeight: '600'
                      }}
                    >
                      Do not have an account?
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Login;