// app/main.tsx
// Entry point: providers and routes. One page per step so no screen is crowded.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

import { DashboardPage } from '@/app/pages/DashboardPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { AssessmentPage } from '@/app/pages/detector/AssessmentPage';
import { BillPage } from '@/app/pages/detector/BillPage';
import { NotificationsPage } from '@/app/pages/detector/NotificationsPage';
import { OrderPage } from '@/app/pages/detector/OrderPage';
import { PickupDetailsPage } from '@/app/pages/detector/PickupDetailsPage';
import { PickupPhotosPage } from '@/app/pages/detector/PickupPhotosPage';
import { SettlementPage } from '@/app/pages/detector/SettlementPage';
import { ChoosePhotosPage } from '@/app/pages/detector/ChoosePhotosPage';
import { RentalsPage } from '@/app/pages/detector/RentalsPage';
import { ReviewPage } from '@/app/pages/detector/ReviewPage';
import { UploadedPage } from '@/app/pages/detector/UploadedPage';
import { InspectorPage } from '@/app/pages/inspector/InspectorPage';
import { OrderReviewPage } from '@/app/pages/inspector/OrderReviewPage';
import { WelcomePage } from '@/app/pages/WelcomePage';
import { ReturnDraftProvider } from '@/app/state/returnDraft';
import { AppShell } from '@/components/AppShell';

import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <ReturnDraftProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<WelcomePage />} />
            <Route path="detector" element={<RentalsPage />} />
            <Route path="detector/pickup" element={<PickupDetailsPage />} />
            <Route path="detector/pickup/photos" element={<PickupPhotosPage />} />
            <Route path="detector/return/:rentalId" element={<ChoosePhotosPage />} />
            <Route path="detector/return/:rentalId/review" element={<ReviewPage />} />
            <Route path="detector/return/:rentalId/uploaded" element={<UploadedPage />} />
            <Route path="detector/return/:rentalId/assessment" element={<AssessmentPage />} />
            <Route path="detector/return/:rentalId/bill" element={<BillPage />} />
            <Route path="detector/return/:rentalId/order" element={<OrderPage />} />
            <Route path="detector/return/:rentalId/settle" element={<SettlementPage />} />
            <Route path="detector/notifications" element={<NotificationsPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="inspector" element={<InspectorPage />} />
            <Route path="inspector/orders/:orderId" element={<OrderReviewPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ReturnDraftProvider>
  </StrictMode>,
);
