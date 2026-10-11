export interface Project {
  id: string;
  title: string;
  description: string;
  template?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string; // Tiptap JSON or HTML
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  projectId: string;
  title: string;
  authors: string;
  publication: string;
  publishedAt: string;
  url: string;
  doi: string;
  abstract: string;
  snippet: string;
  accessedAt: string;
  notes: string;
  semanticMatch?: string;
  tag?: string;
}

export interface Database {
  projects: Project[];
  documents: Document[];
  sources: Source[];
  settings: {
    geminiKey?: string;
    searchKey?: string;
    similarityInterval?: number;
    autoCheckEnabled?: boolean;
    citationStyle?: string;
    theme?: string;
    activeModel?: string;
  };
}

export const INITIAL_DATABASE: Database = {
  projects: [
    {
      id: 'proj-neuro-symbolic',
      title: 'Towards Autonomous Literature Synthesis: Benchmarking Neuro-Symbolic Verification in Scholarly Writing',
      description: 'Preprint Manuscript · arXiv:2409.11894v2 [cs.AI]',
      template: 'IEEE Transactions',
      createdAt: '2025-02-10T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-transformer-bio',
      title: 'Empirical Evaluation of Attention Networks in Molecular Docking and Protein Fold Binding',
      description: 'Bioinformatics Research Project · Nature MI Draft',
      template: 'Nature Conference',
      createdAt: '2025-01-15T14:30:00.000Z',
      updatedAt: '2025-02-05T12:00:00.000Z',
    },
    {
      id: 'proj-eth-grant',
      title: 'Autonomous Academic Co-Authorship & Heuristic Fact Verification in Distributed Repositories',
      description: 'Swiss National Science Foundation (SNSF) Grant Proposal #204128',
      template: 'NIH Grant Proposal',
      createdAt: '2024-11-20T09:15:00.000Z',
      updatedAt: '2025-01-28T16:45:00.000Z',
    }
  ],
  documents: [
    {
      id: 'doc-manuscript-draft',
      projectId: 'proj-neuro-symbolic',
      title: 'Neural-Symbolic Architectures in Automated Literature Synthesis.docx',
      wordCount: 3842,
      content: `<h1>Towards Autonomous Literature Synthesis: Benchmarking Neuro-Symbolic Verification in Scholarly Writing</h1><p><em>Dr. Elena Rostova<sup>1</sup>, Marcus Vance<sup>2</sup>, Prof. Aaron Lin<sup>3</sup></em><br>Department of Computer Science &amp; Center for Learning Systems, ETH Zürich<br>{elena.rostova, mvance, alin}@inf.ethz.ch</p><hr><blockquote><strong>Abstract:</strong> The rapid integration of neural language models into academic research workflows has accelerated drafting while introducing critical risks of ungrounded citation synthesis and hallucinated empirical claims. In this paper, we introduce a dual-channel Neuro-Symbolic Verification Pipeline (NSVP) that unifies vectorized dense retrieval with explicit Datalog deduction rules. Across a corpus of 12,400 peer-reviewed papers spanning computer science and biomedical literature, our approach demonstrates a 41.2% absolute reduction in unverified claims while preserving rhetorical fluidity.</blockquote><h2>1. Introduction &amp; Related Landscape</h2><p>Autonomous scholarly synthesis demands rigorous epistemological grounding. While modern foundational models generate syntactically convincing literature reviews, empirical evaluations demonstrate that up to 34% of generated attributions either misrepresent primary source findings or synthesize non-existent DOIs [Chen et al., 2024, p. 12].</p><p>By coupling continuous neuro-attention matrices with first-order horn clause logic, we guarantee that every asserted finding directly resolves to a registered open-access repository or clinical trial registration [Kowalski, 2023]. As detailed in Section 2, this hybrid representation prevents spurious inference loops without sacrificing generative speed.</p><p>Prior attempts relied predominantly on post-hoc regex filters or heuristic citation scrapers. In contrast, our pipeline validates syntactic proofs over the parsed abstract structure before the editorial engine registers paragraph completion.</p><h2>2. Neuro-Symbolic Verification Architecture</h2><p>We formulate literature verification as a dual-channel constraint satisfaction problem over directed bipartite citation graphs. Each node corresponds to a discrete assertion tokenized with sentence-level boundaries.</p>`,
      createdAt: '2025-02-10T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    }
  ],
  sources: [
    {
      id: 'src-1',
      projectId: 'proj-neuro-symbolic',
      title: 'Knowledge Graph Augmented LLMs for Scientific Factuality',
      authors: 'B. Chen et al.',
      publication: 'NeurIPS',
      publishedAt: '2024',
      url: 'https://doi.org/10.48550/arXiv.2409.11894',
      doi: '10.48550/arXiv.2409.11894',
      abstract: 'Proposes dual-channel verification reducing hallucination by 41% in citation generation.',
      snippet: 'Proposes dual-channel verification reducing hallucination by 41% in citation generation.',
      accessedAt: '2025-02-10T10:00:00.000Z',
      notes: '',
      semanticMatch: '94%',
      tag: 'Peer-Reviewed'
    },
    {
      id: 'src-2',
      projectId: 'proj-neuro-symbolic',
      title: 'Hybrid Neuro-Symbolic Theorem Proving in Natural Deduction',
      authors: 'M. Valdivia',
      publication: 'Oxford Press',
      publishedAt: '2023',
      url: '',
      doi: '10.1093/oxford.2023.981',
      abstract: 'Combines Transformer attention heads with Datalog horn clauses for formal rule verification.',
      snippet: 'Combines Transformer attention heads with Datalog horn clauses for formal rule verification.',
      accessedAt: '2025-02-10T10:00:00.000Z',
      notes: '',
      semanticMatch: '89%',
      tag: 'Verified Proof'
    },
    {
      id: 'src-3',
      projectId: 'proj-neuro-symbolic',
      title: 'Automated Synthesis of Biomedical Meta-Analyses',
      authors: 'J. Kowalski et al.',
      publication: 'Nature MI',
      publishedAt: '2023',
      url: '',
      doi: '10.1038/s42256-023-00712-4',
      abstract: 'Large-scale corpus synthesis with strict boundary auditing against false medical claims.',
      snippet: 'Large-scale corpus synthesis with strict boundary auditing against false medical claims.',
      accessedAt: '2025-02-10T10:00:00.000Z',
      notes: '',
      semanticMatch: '91%',
      tag: 'Open Access'
    }
  ],
  settings: {
    geminiKey: '',
    searchKey: '',
    similarityInterval: 90,
    autoCheckEnabled: false,
    citationStyle: 'IEEE',
    theme: 'light'
  }
};

export const dbService = {
  async readDb(): Promise<Database> {
    let db: Database | null = null;
    if ((window as any).electronAPI) {
      db = await (window as any).electronAPI.readDb();
    } else {
      const data = localStorage.getItem('paperpilot_db');
      if (data) {
        try {
          db = JSON.parse(data);
        } catch {
          db = null;
        }
      }
    }

    if (!db || !db.projects || db.projects.length === 0) {
      // Seed with rich initial academic data
      await this.writeDb(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }

    return db;
  },

  async writeDb(db: Database): Promise<void> {
    if ((window as any).electronAPI) {
      return (window as any).electronAPI.writeDb(db);
    }
    localStorage.setItem('paperpilot_db', JSON.stringify(db));
  }
};
