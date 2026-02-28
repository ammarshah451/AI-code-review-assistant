// Repositories Page - Manage connected repositories

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderGit2,
  Plus,
  Trash2,
  Settings,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { PageHeader, EmptyState, LoadingState } from '../components/Layout'
import { useRepositories, useDeleteRepository, useCreateRepository } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'
import type { Repository } from '../types'

interface AddRepoModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { github_id: number; full_name: string }) => void
  isLoading: boolean
}

function AddRepoModal({ isOpen, onClose, onSubmit, isLoading }: AddRepoModalProps) {
  const [fullName, setFullName] = useState('')
  const [githubId, setGithubId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fullName && githubId) {
      onSubmit({ full_name: fullName, github_id: parseInt(githubId, 10) })
      setFullName('')
      setGithubId('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md pointer-events-auto"
        >
          <div className="liquid-border p-[1px] rounded-2xl">
            <div className="bg-void-100 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-bold text-white">
                  Connect Repository
                </h2>
                <button
                  onClick={onClose}
                  type="button"
                  className="p-2 rounded-lg hover:bg-void-200 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="owner/repository"
                    className="cyber-input w-full"
                    autoComplete="off"
                    required
                  />
                  <p className="text-xs text-gray-600 mt-1 font-mono">
                    e.g., facebook/react
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    GitHub ID
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={githubId}
                    onChange={(e) => setGithubId(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456789"
                    className="cyber-input w-full"
                    autoComplete="off"
                    required
                  />
                  <p className="text-xs text-gray-600 mt-1 font-mono">
                    Run: gh api repos/OWNER/REPO --jq '.id'
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 cyber-button cyber-button-ghost rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !fullName || !githubId}
                    className="flex-1 cyber-button cyber-button-primary rounded-xl disabled:opacity-50"
                  >
                    {isLoading ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  isOpen: boolean
  repo: Repository | null
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}

function DeleteConfirmModal({ isOpen, repo, onClose, onConfirm, isLoading }: DeleteConfirmModalProps) {
  if (!isOpen || !repo) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-cyber-crimson/20 flex items-center justify-center">
                <AlertTriangle className="text-cyber-crimson" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  Delete Repository
                </h2>
                <p className="text-sm text-gray-500 font-mono">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to delete{' '}
              <span className="text-white font-mono">{repo.full_name}</span>?
              All associated reviews and findings will also be deleted.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 cyber-button cyber-button-ghost rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-cyber-crimson/20 border border-cyber-crimson/50 text-cyber-crimson font-mono font-medium hover:bg-cyber-crimson/30 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function RepositoryCard({
  repo,
  index,
  onDelete,
  onSettings,
}: {
  repo: Repository
  index: number
  onDelete: () => void
  onSettings: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative overflow-hidden"
    >
      <div className="glass-card p-4 hover:bg-void-50 transition-colors relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyber-magenta/20 to-cyber-cyan/20 border border-white/10 flex items-center justify-center relative overflow-hidden"
              whileHover={{ scale: 1.05 }}
            >
              {/* Icon Scanline */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent"
                initial={{ y: '-100%' }}
                whileHover={{ y: '100%' }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <FolderGit2 className="text-cyber-magenta" size={24} />
            </motion.div>

            {/* Info */}
            <div>
              <h3 className="font-display font-semibold text-white group-hover:text-cyber-cyan transition-colors">
                {repo.full_name}
              </h3>
              <div className="flex items-center gap-3 text-sm text-gray-500 font-mono">
                <span>ID: {repo.github_id}</span>
                <span>•</span>
                <span>Connected {timeAgo}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onSettings}
              className="p-2 rounded-lg hover:bg-void-200 text-gray-400 hover:text-cyber-cyan transition-colors"
              title="Settings"
            >
              <Settings size={18} />
            </button>
            <a
              href={`https://github.com/${repo.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-void-200 text-gray-400 hover:text-white transition-colors"
              title="View on GitHub"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={onDelete}
              className="p-2 rounded-lg hover:bg-cyber-crimson/20 text-gray-400 hover:text-cyber-crimson transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Card Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyber-cyan/5 to-transparent skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      </div>
    </motion.div>
  )
}

export function Repositories() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteRepo, setDeleteRepo] = useState<Repository | null>(null)

  const { data, isLoading } = useRepositories(page, 10)
  const createMutation = useCreateRepository()
  const deleteMutation = useDeleteRepository()

  const handleCreate = (repoData: { github_id: number; full_name: string }) => {
    createMutation.mutate(repoData, {
      onSuccess: () => {
        setShowAddModal(false)
      },
    })
  }

  const handleDelete = () => {
    if (deleteRepo) {
      deleteMutation.mutate(deleteRepo.id, {
        onSuccess: () => {
          setDeleteRepo(null)
        },
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Repositories"
        subtitle={`${data?.total ?? 0} connected repositories`}
        action={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="cyber-button cyber-button-primary rounded-xl flex items-center gap-2"
          >
            <Plus size={18} />
            Connect Repo
          </motion.button>
        }
      />

      {/* Repository list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isLoading ? (
          <LoadingState />
        ) : data?.items.length ? (
          <div className="space-y-3">
            {data.items.map((repo, index) => (
              <RepositoryCard
                key={repo.id}
                repo={repo}
                index={index}
                onDelete={() => setDeleteRepo(repo)}
                onSettings={() => navigate(`/repositories/${repo.id}/settings`)}
              />
            ))}

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8 pt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-void-200 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="font-mono text-sm text-gray-400">
                  {page} / {data.pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                  disabled={page === data.pages}
                  className="p-2 rounded-lg bg-void-200 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card p-8">
            <EmptyState
              icon={<FolderGit2 size={32} />}
              title="No repositories connected"
              description="Connect a GitHub repository to start receiving AI-powered code reviews on your pull requests."
              action={
                <button
                  onClick={() => setShowAddModal(true)}
                  className="cyber-button cyber-button-primary rounded-xl"
                >
                  Connect Your First Repo
                </button>
              }
            />
          </div>
        )}
      </motion.div>

      {/* Modals */}
      <AddRepoModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={!!deleteRepo}
        repo={deleteRepo}
        onClose={() => setDeleteRepo(null)}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
