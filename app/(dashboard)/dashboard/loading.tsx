import PulsatingLoader from '@/components/ui/pulsating-loader';

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <PulsatingLoader />
    </div>
  );
}
