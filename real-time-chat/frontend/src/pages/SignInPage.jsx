import { SignIn } from '@clerk/react';

const SignInPage = () => {
  return (
    <div className="chat-app-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
};

export default SignInPage;
