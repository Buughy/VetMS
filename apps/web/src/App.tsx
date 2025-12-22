import { createBrowserRouter, RouterProvider, Outlet, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import InvoiceForm from './components/InvoiceForm';
import ProductTable from './components/ProductTable';
import InvoiceList from './components/InvoiceList';
import AdminPanel from './components/AdminPanel';

const router = createBrowserRouter([
  {
    element: (
      <Layout>
        <Outlet />
      </Layout>
    ),
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/invoice', element: <InvoiceForm /> },
      { path: '/invoice/:id', element: <InvoiceForm /> },
      { path: '/invoices', element: <InvoiceList /> },
      { path: '/products', element: <ProductTable /> },
      { path: '/admin', element: <AdminPanel /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
