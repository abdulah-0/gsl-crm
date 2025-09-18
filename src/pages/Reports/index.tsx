import React from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

const Reports: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Reports & Analytics | GSL Pakistan CRM</title>
        <meta name="description" content="Analytics and KPIs for leads, classes, finance, and performance." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary mb-3" style={{ fontFamily: 'Nunito Sans' }}>
              Reports & Analytics
            </h1>
            <p className="text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>
              Charts and insights will be displayed here.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1,2,3,4].map((i) => (
                <div key={i} className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6 h-48 flex items-center justify-center text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>
                  Chart placeholder {i}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default Reports;

