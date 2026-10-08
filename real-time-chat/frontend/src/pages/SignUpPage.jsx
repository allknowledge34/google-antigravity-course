import { SignUp } from '@clerk/react';

const SignUpPage = () => {
  return (
    <div className="chat-app-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
};

export default SignUpPage;
