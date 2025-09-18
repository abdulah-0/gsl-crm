import React from 'react';
import { Helmet } from 'react-helmet';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';

const Finances: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Finances | GSL Pakistan CRM</title>
        <meta name="description" content="Track cash flow, expenses, revenue, and financial reports." />
      </Helmet>

      <main className="w-full min-h-screen bg-background-main flex">
        <div className="w-[14%] min-w-[200px] hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
          <Header />

          <section className="mt-8 lg:mt-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-4xl text-text-primary mb-3" style={{ fontFamily: 'Nunito Sans' }}>
              Finances
            </h1>
            <p className="text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>
              Finance dashboard and transactions will appear here.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {["Revenue","Expenses","Profit"].map((label) => (
                <div key={label} className="bg-background-card rounded-xl shadow-[0px_6px_58px_#c3cbd61a] p-6">
                  <p className="text-sm text-text-muted" style={{ fontFamily: 'Nunito Sans' }}>This Month</p>
                  <h3 className="text-3xl font-bold text-text-primary" style={{ fontFamily: 'Nunito Sans' }}>0</h3>
                  <p className="text-text-secondary" style={{ fontFamily: 'Nunito Sans' }}>{label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default Finances;

