import { AppDialog } from '../AppDialog'
import { DialogPanel } from '../ui/DialogPanel'
import { MemoriesAlbumSection } from './MemoriesAlbumSection'
import type { FamilyChild, FamilyMemberRecord } from '../../lib/familyData'
import type { AppMemory } from '../../lib/memoryTypes'
import type { BookletMemory } from '../../lib/memoriesBooklet'

type Props = {
  open: boolean
  onClose: () => void
  memories: AppMemory[]
  userName: string
  journalName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  onDownload?: () => void
  onSave?: () => void
  saving?: boolean
  onRemovePhoto?: (m: BookletMemory) => void
  onDeleteMemory?: (m: BookletMemory) => void
}

export function MemoriesAlbumModal({
  open,
  onClose,
  memories,
  userName,
  journalName,
  lang,
  familyChildren,
  members,
  onDownload,
  onSave,
  saving,
  onRemovePhoto,
  onDeleteMemory,
}: Props) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="lg"
      align="bottom"
      ariaLabel={lang === 'el' ? 'Άλμπουμ αναμνήσεων' : 'Memories album'}
      panelClassName="hm-memory-album-modal"
    >
      <DialogPanel variant="white" padding="lg" className="hm-memory-album-modal__panel">
        <MemoriesAlbumSection
          layout="modal"
          memories={memories}
          userName={userName}
          journalName={journalName}
          lang={lang}
          familyChildren={familyChildren}
          members={members}
          onDownload={onDownload}
          onSave={onSave}
          saving={saving}
          onRemovePhoto={onRemovePhoto}
          onDeleteMemory={onDeleteMemory}
          onClose={onClose}
        />
      </DialogPanel>
    </AppDialog>
  )
}
