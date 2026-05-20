'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import BoringAvatar from 'boring-avatars';
import { getAvatarPalette } from '@/lib/utils';

interface MatchInviteModalProps {
  open: boolean;
  invite: any; // { matchId, inviterAddress, match }
  onClose: () => void;
  onAccept?: () => void;
}

export function MatchInviteModal({ open, invite, onClose, onAccept }: MatchInviteModalProps) {
  const [responding, setResponding] = useState(false);
  const acceptMutation = useMutation(api.challenges.acceptChallengeInvite);
  const rejectMutation = useMutation(api.challenges.rejectChallengeInvite);

  const handleAccept = async () => {
    if (!invite?._id) return;
    setResponding(true);
    try {
      await acceptMutation({ 
        inviteId: invite._id,
        _serverToken: process.env.NEXT_PUBLIC_CONVEX_ADMIN_TOKEN,
      });
      onAccept?.();
      onClose();
    } catch (error) {
      console.error('Failed to accept invite:', error);
    } finally {
      setResponding(false);
    }
  };

  const handleReject = async () => {
    if (!invite?._id) return;
    setResponding(true);
    try {
      await rejectMutation({ 
        inviteId: invite._id,
        _serverToken: process.env.NEXT_PUBLIC_CONVEX_ADMIN_TOKEN,
      });
      onClose();
    } catch (error) {
      console.error('Failed to reject invite:', error);
    } finally {
      setResponding(false);
    }
  };

  if (!invite?.match) return null;

  const match = invite.match;
  const inviterAddr = invite.inviterAddress?.slice(0, 6) + '...' + invite.inviterAddress?.slice(-4);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Challenge Invitation</DialogTitle>
          <DialogDescription>
            You've been invited to a match
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match Details */}
          <div className="bg-gray-50 dark:bg-neutral-900 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Game</p>
              <p className="font-semibold text-gray-900 dark:text-white">{match.gameTitle || 'Esports Challenge'}</p>
            </div>
            
            {match.gameMode && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mode</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{match.gameMode}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Inviter</p>
              <div className="flex items-center gap-2 mt-1">
                <BoringAvatar
                  name={invite.inviterAddress}
                  variant="beam"
                  size={20}
                  palette={getAvatarPalette(invite.inviterAddress)}
                />
                <span className="text-sm text-gray-900 dark:text-white">{inviterAddr}</span>
              </div>
            </div>

            {match.startTime && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Starts</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(match.startTime * 1000).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleAccept}
              disabled={responding}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              Accept
            </Button>
            <Button
              onClick={handleReject}
              disabled={responding}
              variant="outline"
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Decline
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
