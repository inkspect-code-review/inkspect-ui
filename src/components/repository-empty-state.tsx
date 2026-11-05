import { DashboardIcon } from "./dashboard-icon";
import styles from "./repositories-workspace.module.css";

export function RepositoryEmptyState() {
  return <div className={styles.descriptionEmpty} role="status"><DashboardIcon name="repositories" />
    <h3>This repository is empty.</h3><p>Add your first commit, then index this repository.</p>
  </div>;
}
