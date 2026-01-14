import { Folder } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import type { Project } from '@/lib/electron';

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onConfirm: (projectId: string) => void;
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
  onConfirm,
}: DeleteProjectDialogProps) {
  const handleConfirm = () => {
    if (project) {
      onConfirm(project.id);
    }
  };

  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={handleConfirm}
      title="Projekt löschen"
      description="Bist du sicher, dass du dieses Projekt in den Papierkorb verschieben möchtest?"
      confirmText="In Papierkorb verschieben"
      testId="delete-project-dialog"
      confirmTestId="confirm-delete-project"
    >
      {project && (
        <>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-sidebar-accent/10 border border-sidebar-border">
            <div className="w-10 h-10 rounded-lg bg-sidebar-accent/20 border border-sidebar-border flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-brand-500" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{project.name}</p>
              <p className="text-xs text-muted-foreground truncate">{project.path}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Der Ordner bleibt auf der Festplatte, bis du ihn endgültig aus dem Papierkorb löschst.
          </p>
        </>
      )}
    </DeleteConfirmDialog>
  );
}
