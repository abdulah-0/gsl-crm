import React from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

const InfoPortal: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Info Portal | GSL Pakistan CRM</title>
        <meta name="description" content="Central portal for policies, templates, and resources." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary mb-3" style={{ fontFamily: 'Nunito Sans' }}>
              Info Portal
            </h1>
            <p className="text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>
              Find internal documents, SOPs and knowledge base.
            </p>

            <div className="mt-6 bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-8 text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
              Content coming soon.
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default InfoPortal;

