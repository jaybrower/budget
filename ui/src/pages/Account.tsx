import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';

export function Account() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Account Information
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{user?.email}</dd>
          </div>
          {user?.firstName && (
            <div>
              <dt className="text-sm font-medium text-gray-500">First Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.firstName}</dd>
            </div>
          )}
          {user?.lastName && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.lastName}</dd>
            </div>
          )}
          {user?.createdAt && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Member Since</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Layout>
  );
}
