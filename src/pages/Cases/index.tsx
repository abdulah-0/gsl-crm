import React from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

const Cases: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>On Going Cases | GSL Pakistan CRM</title>
        <meta name="description" content="Manage and track ongoing university cases, tasks, and assignees in the GSL CRM." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        {/* Sidebar */}
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary mb-3"
              style={{ fontFamily: 'Nunito Sans' }}
            >
              On Going Cases
            </h1>
            <p className="text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>
              This section will list all ongoing cases with filters, priority and assignees.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <img src="/images/img_image.svg" alt="Case" className="w-10 h-10" />
                    <div>
                      <p className="text-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>PN00012{i}</p>
                      <h3 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>University Of Dundee</h3>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>Created Sep 12, 2020</span>
                    <span className="text-sm font-bold" style={{ color: '#ffbd21', fontFamily: 'Nunito Sans' }}>medium</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default Cases;

